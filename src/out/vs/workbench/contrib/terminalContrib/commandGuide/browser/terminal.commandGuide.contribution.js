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
import { addDisposableListener } from "../../../../../base/browser/dom.js";
import { combinedDisposable, Disposable, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { listInactiveSelectionBackground } from "../../../../../platform/theme/common/colorRegistry.js";
import { registerColor, transparent } from "../../../../../platform/theme/common/colorUtils.js";
import { PANEL_BORDER } from "../../../../common/theme.js";
import { registerTerminalContribution } from "../../../terminal/browser/terminalExtensions.js";
import { terminalCommandGuideConfigSection, TerminalCommandGuideSettingId } from "../common/terminalCommandGuideConfiguration.js";
import { isFullTerminalCommand } from "../../../../../platform/terminal/common/capabilities/commandDetection/terminalCommand.js";
let TerminalCommandGuideContribution = class extends Disposable {
  constructor(_ctx, _configurationService) {
    super();
    this._ctx = _ctx;
    this._configurationService = _configurationService;
    this._activeCommandGuide = this._register(new MutableDisposable());
  }
  static {
    this.ID = "terminal.commandGuide";
  }
  static get(instance) {
    return instance.getContribution(TerminalCommandGuideContribution.ID);
  }
  xtermOpen(xterm) {
    this._xterm = xterm;
    this._refreshActivatedState();
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalCommandGuideSettingId.ShowCommandGuide)) {
        this._refreshActivatedState();
      }
    }));
  }
  _refreshActivatedState() {
    const xterm = this._xterm;
    if (!xterm) {
      return;
    }
    const showCommandGuide = this._configurationService.getValue(terminalCommandGuideConfigSection).showCommandGuide;
    if (!!this._activeCommandGuide.value === showCommandGuide) {
      return;
    }
    if (!showCommandGuide) {
      this._activeCommandGuide.clear();
    } else {
      const screenElement = xterm.raw.element.querySelector(".xterm-screen");
      const viewportElement = xterm.raw.element.querySelector(".xterm-viewport");
      this._activeCommandGuide.value = combinedDisposable(
        addDisposableListener(screenElement, "mousemove", (e) => this._tryShowHighlight(screenElement, xterm, e)),
        addDisposableListener(viewportElement, "mousemove", (e) => this._tryShowHighlight(screenElement, xterm, e)),
        addDisposableListener(xterm.raw.element, "mouseleave", () => xterm.markTracker.showCommandGuide(void 0)),
        xterm.raw.onData(() => xterm.markTracker.showCommandGuide(void 0)),
        toDisposable(() => xterm.markTracker.showCommandGuide(void 0))
      );
    }
  }
  _tryShowHighlight(element, xterm, e) {
    const rect = element.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const mouseCursorY = Math.floor((e.clientY - rect.top) / (rect.height / xterm.raw.rows));
    const command = this._ctx.instance.capabilities.get(TerminalCapability.CommandDetection)?.getCommandForLine(xterm.raw.buffer.active.viewportY + mouseCursorY);
    if (command && isFullTerminalCommand(command)) {
      xterm.markTracker.showCommandGuide(command);
    } else {
      xterm.markTracker.showCommandGuide(void 0);
    }
  }
};
TerminalCommandGuideContribution = __decorateClass([
  __decorateParam(1, IConfigurationService)
], TerminalCommandGuideContribution);
registerTerminalContribution(TerminalCommandGuideContribution.ID, TerminalCommandGuideContribution, false);
const TERMINAL_COMMAND_GUIDE_COLOR = registerColor("terminalCommandGuide.foreground", {
  dark: transparent(listInactiveSelectionBackground, 1),
  light: transparent(listInactiveSelectionBackground, 1),
  hcDark: PANEL_BORDER,
  hcLight: PANEL_BORDER
}, localize("terminalCommandGuide.foreground", "The foreground color of the terminal command guide that appears to the left of a command and its output on hover."));
export {
  TERMINAL_COMMAND_GUIDE_COLOR
};
