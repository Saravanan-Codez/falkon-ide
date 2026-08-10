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
import { $, addDisposableListener, addStandardDisposableListener, getWindow } from "../../../../../base/browser/dom.js";
import { debounce, throttle } from "../../../../../base/common/decorators.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable, MutableDisposable, combinedDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { removeAnsiEscapeCodes } from "../../../../../base/common/strings.js";
import "./media/stickyScroll.css";
import { localize } from "../../../../../nls.js";
import { IMenuService, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { isFullTerminalCommand } from "../../../../../platform/terminal/common/capabilities/commandDetection/terminalCommand.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { ITerminalConfigurationService } from "../../../terminal/browser/terminal.js";
import { openContextMenu } from "../../../terminal/browser/terminalContextMenu.js";
import { TERMINAL_CONFIG_SECTION, TerminalCommandId } from "../../../terminal/common/terminal.js";
import { terminalStrings } from "../../../terminal/common/terminalStrings.js";
import { TerminalStickyScrollSettingId } from "../common/terminalStickyScrollConfiguration.js";
import { terminalStickyScrollBackground, terminalStickyScrollHoverBackground } from "./terminalStickyScrollColorRegistry.js";
import { XtermAddonImporter } from "../../../terminal/browser/xterm/xtermAddonImporter.js";
var OverlayState = /* @__PURE__ */ ((OverlayState2) => {
  OverlayState2[OverlayState2["Off"] = 0] = "Off";
  OverlayState2[OverlayState2["On"] = 1] = "On";
  return OverlayState2;
})(OverlayState || {});
var CssClasses = /* @__PURE__ */ ((CssClasses2) => {
  CssClasses2["Visible"] = "visible";
  return CssClasses2;
})(CssClasses || {});
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["StickyScrollPercentageCap"] = 0.4] = "StickyScrollPercentageCap";
  return Constants2;
})(Constants || {});
let TerminalStickyScrollOverlay = class extends Disposable {
  constructor(_instance, _xterm, _xtermColorProvider, _commandDetection, xtermCtor, configurationService, contextKeyService, _contextMenuService, _keybindingService, menuService, _terminalConfigurationService, _themeService) {
    super();
    this._instance = _instance;
    this._xterm = _xterm;
    this._xtermColorProvider = _xtermColorProvider;
    this._commandDetection = _commandDetection;
    this._contextMenuService = _contextMenuService;
    this._keybindingService = _keybindingService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._themeService = _themeService;
    this._xtermAddonLoader = new XtermAddonImporter();
    this._webglAddon = this._register(new MutableDisposable());
    this._refreshListeners = this._register(new MutableDisposable());
    this._state = 0 /* Off */;
    this._isRefreshQueued = false;
    this._rawMaxLineCount = 5;
    this._ignoredCommands = [];
    this._pendingShowOperation = false;
    this._contextMenu = this._register(menuService.createMenu(MenuId.TerminalStickyScrollContext, contextKeyService));
    this._register(Event.runAndSubscribe(this._xterm.raw.buffer.onBufferChange, (buffer) => {
      this._setState((buffer ?? this._xterm.raw.buffer.active).type === "normal" ? 1 /* On */ : 0 /* Off */);
    }));
    this._register(Event.runAndSubscribe(configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(TerminalStickyScrollSettingId.MaxLineCount)) {
        this._rawMaxLineCount = configurationService.getValue(TerminalStickyScrollSettingId.MaxLineCount);
      }
      if (!e || e.affectsConfiguration(TerminalStickyScrollSettingId.IgnoredCommands)) {
        this._ignoredCommands = configurationService.getValue(TerminalStickyScrollSettingId.IgnoredCommands);
      }
    }));
    this._register(this._instance.onDidChangeTarget(() => this._syncOptions()));
    xtermCtor.then((ctor) => {
      if (this._store.isDisposed) {
        return;
      }
      this._stickyScrollOverlay = this._register(new ctor({
        rows: 1,
        cols: this._xterm.raw.cols,
        allowProposedApi: true,
        ...this._getOptions()
      }));
      this._refreshGpuAcceleration();
      this._register(configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(TERMINAL_CONFIG_SECTION)) {
          this._syncOptions();
        }
      }));
      this._register(this._themeService.onDidColorThemeChange(() => {
        this._syncOptions();
      }));
      this._register(this._xterm.raw.onResize(() => {
        this._syncOptions();
        this._refresh();
      }));
      this._register(this._instance.onDidChangeVisibility((isVisible) => {
        if (isVisible) {
          this._refresh();
        }
      }));
      this._xtermAddonLoader.importAddon("serialize").then((SerializeAddon) => {
        if (this._store.isDisposed) {
          return;
        }
        this._serializeAddon = this._register(new SerializeAddon());
        this._xterm.raw.loadAddon(this._serializeAddon);
        this._refresh();
      });
    });
  }
  lockHide() {
    this._element?.classList.add("lock-hide");
  }
  unlockHide() {
    this._element?.classList.remove("lock-hide");
  }
  _setState(state) {
    if (this._state === state) {
      return;
    }
    this._state = state;
    switch (state) {
      case 0 /* Off */: {
        this._setVisible(false);
        this._uninstallRefreshListeners();
        break;
      }
      case 1 /* On */: {
        this._refresh();
        this._installRefreshListeners();
        break;
      }
    }
  }
  _installRefreshListeners() {
    if (!this._refreshListeners.value) {
      this._refreshListeners.value = combinedDisposable(
        Event.any(
          this._xterm.raw.onScroll,
          this._xterm.raw.onLineFeed,
          // Rarely an update may be required after just a cursor move, like when
          // scrolling horizontally in a pager
          this._xterm.raw.onCursorMove
        )(() => this._refresh()),
        // eslint-disable-next-line no-restricted-syntax
        addStandardDisposableListener(this._xterm.raw.element.querySelector(".xterm-viewport"), "scroll", () => this._refresh())
      );
    }
  }
  _uninstallRefreshListeners() {
    this._refreshListeners.clear();
  }
  _setVisible(isVisible) {
    if (isVisible) {
      this._pendingShowOperation = true;
      this._show();
    } else {
      this._hide();
    }
  }
  _show() {
    if (this._pendingShowOperation) {
      this._ensureElement();
      this._element?.classList.toggle("visible" /* Visible */, true);
    }
    this._pendingShowOperation = false;
  }
  _hide() {
    this._pendingShowOperation = false;
    this._element?.classList.toggle("visible" /* Visible */, false);
  }
  _refresh() {
    if (this._isRefreshQueued) {
      return;
    }
    this._isRefreshQueued = true;
    queueMicrotask(() => {
      this._refreshNow();
      this._isRefreshQueued = false;
    });
  }
  _refreshNow() {
    const command = this._commandDetection.getCommandForLine(this._xterm.raw.buffer.active.viewportY);
    this._currentStickyCommand = void 0;
    if (!command || this._isIgnoredCommand(command)) {
      this._setVisible(false);
      return;
    }
    if (!isFullTerminalCommand(command)) {
      const partialCommand = this._commandDetection.currentCommand;
      if (partialCommand?.commandStartMarker && partialCommand.commandExecutedMarker) {
        this._updateContent(partialCommand, partialCommand.commandStartMarker);
        return;
      }
      this._setVisible(false);
      return;
    }
    const marker = command.marker;
    if (!marker || marker.line === -1) {
      this._setVisible(false);
      return;
    }
    this._updateContent(command, marker);
  }
  _updateContent(command, startMarker) {
    const xterm = this._xterm.raw;
    if (!xterm.element?.parentElement || !this._stickyScrollOverlay || !this._serializeAddon) {
      return;
    }
    if (command.promptStartMarker?.line === -1) {
      this._setVisible(false);
      return;
    }
    const buffer = xterm.buffer.active;
    const promptRowCount = command.getPromptRowCount();
    const commandRowCount = command.getCommandRowCount();
    const stickyScrollLineStart = startMarker.line - (promptRowCount - 1);
    const isPartialCommand = !isFullTerminalCommand(command);
    const rowOffset = !isPartialCommand && command.endMarker ? Math.max(buffer.viewportY - command.endMarker.line + 1, 0) : 0;
    const maxLineCount = Math.min(this._rawMaxLineCount, Math.floor(xterm.rows * 0.4 /* StickyScrollPercentageCap */));
    const stickyScrollLineCount = Math.min(promptRowCount + commandRowCount - 1, maxLineCount) - rowOffset;
    const isTruncated = stickyScrollLineCount < promptRowCount + commandRowCount - 1;
    if (buffer.viewportY <= stickyScrollLineStart) {
      this._setVisible(false);
      return;
    }
    if (isPartialCommand && buffer.viewportY === buffer.baseY && buffer.cursorY === xterm.rows - 1) {
      const line = buffer.getLine(buffer.baseY + xterm.rows - 1);
      if (buffer.cursorX === 1 && lineStartsWith(line, ":") || buffer.cursorX === 5 && lineStartsWith(line, "(END)")) {
        this._setVisible(false);
        return;
      }
    }
    const content = this._serializeAddon.serialize({
      range: {
        start: stickyScrollLineStart + rowOffset,
        end: stickyScrollLineStart + rowOffset + Math.max(stickyScrollLineCount - 1, 0)
      }
    }) + (isTruncated ? "\x1B[0m \u2026" : "");
    if (isPartialCommand && removeAnsiEscapeCodes(content).length === 0) {
      this._setVisible(false);
      return;
    }
    if (content && this._currentContent !== content || this._stickyScrollOverlay.cols !== xterm.cols || this._stickyScrollOverlay.rows !== stickyScrollLineCount) {
      this._stickyScrollOverlay.resize(this._stickyScrollOverlay.cols, stickyScrollLineCount);
      this._stickyScrollOverlay.write("\x1B[0m\x1B[H\x1B[2J");
      this._stickyScrollOverlay.write(content);
      this._currentContent = content;
    }
    if (content) {
      this._currentStickyCommand = command;
      this._setVisible(true);
      if (this._element) {
        const termBox = xterm.element.getBoundingClientRect();
        if (termBox.height > 0) {
          const rowHeight = termBox.height / xterm.rows;
          const overlayHeight = stickyScrollLineCount * rowHeight;
          let endMarkerOffset = 0;
          if (!isPartialCommand && command.endMarker && command.endMarker.line !== -1) {
            const lastLine = Math.min(command.endMarker.line, buffer.baseY + buffer.cursorY);
            if (buffer.viewportY + stickyScrollLineCount > lastLine) {
              const diff = buffer.viewportY + stickyScrollLineCount - lastLine;
              endMarkerOffset = diff * rowHeight;
            }
          }
          this._element.style.bottom = `${termBox.height - overlayHeight + 1 + endMarkerOffset}px`;
        }
      }
    } else {
      this._setVisible(false);
    }
  }
  _ensureElement() {
    if (
      // The element is already created
      this._element || // If the overlay is yet to be created, the terminal cannot be opened so defer to next call
      !this._stickyScrollOverlay || // The xterm.js instance isn't opened yet
      !this._xterm?.raw.element?.parentElement
    ) {
      return;
    }
    const overlay = this._stickyScrollOverlay;
    const hoverOverlay = $(".hover-overlay");
    this._element = $(".terminal-sticky-scroll", void 0, hoverOverlay);
    this._xterm.raw.element.parentElement.append(this._element);
    this._register(toDisposable(() => this._element?.remove()));
    let hoverTitle = localize("stickyScrollHoverTitle", "Navigate to Command");
    const scrollToPreviousCommandKeybinding = this._keybindingService.lookupKeybinding(TerminalCommandId.ScrollToPreviousCommand);
    if (scrollToPreviousCommandKeybinding) {
      const label = scrollToPreviousCommandKeybinding.getLabel();
      if (label) {
        hoverTitle += "\n" + localize("labelWithKeybinding", "{0} ({1})", terminalStrings.scrollToPreviousCommand.value, label);
      }
    }
    const scrollToNextCommandKeybinding = this._keybindingService.lookupKeybinding(TerminalCommandId.ScrollToNextCommand);
    if (scrollToNextCommandKeybinding) {
      const label = scrollToNextCommandKeybinding.getLabel();
      if (label) {
        hoverTitle += "\n" + localize("labelWithKeybinding", "{0} ({1})", terminalStrings.scrollToNextCommand.value, label);
      }
    }
    hoverOverlay.title = hoverTitle;
    const scrollBarWidth = this._xterm.raw._core.viewport?.scrollBarWidth;
    if (scrollBarWidth !== void 0) {
      this._element.style.right = `${scrollBarWidth}px`;
    }
    this._stickyScrollOverlay.open(this._element);
    this._stickyScrollOverlay.attachCustomKeyEventHandler((event) => {
      if (event.key === "Tab") {
        return false;
      }
      return true;
    });
    this._xtermAddonLoader.importAddon("ligatures").then((LigaturesAddon) => {
      if (this._store.isDisposed || !this._stickyScrollOverlay) {
        return;
      }
      this._ligaturesAddon = new LigaturesAddon();
      this._stickyScrollOverlay.loadAddon(this._ligaturesAddon);
    });
    this._register(addStandardDisposableListener(hoverOverlay, "click", () => {
      if (this._xterm && this._currentStickyCommand) {
        this._xterm.markTracker.revealCommand(this._currentStickyCommand);
        this._instance.focus();
      }
    }));
    this._register(addStandardDisposableListener(hoverOverlay, "wheel", (e) => this._xterm?.raw.element?.dispatchEvent(new WheelEvent(e.type, e))));
    this._register(addDisposableListener(hoverOverlay, "mousedown", (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
    }));
    this._register(addDisposableListener(hoverOverlay, "contextmenu", (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      openContextMenu(getWindow(hoverOverlay), e, this._instance, this._contextMenu, this._contextMenuService);
    }));
    this._register(addStandardDisposableListener(hoverOverlay, "mouseover", () => overlay.options.theme = this._getTheme(true)));
    this._register(addStandardDisposableListener(hoverOverlay, "mouseleave", () => overlay.options.theme = this._getTheme(false)));
  }
  _syncOptions() {
    if (!this._stickyScrollOverlay) {
      return;
    }
    this._stickyScrollOverlay.resize(this._xterm.raw.cols, this._stickyScrollOverlay.rows);
    this._stickyScrollOverlay.options = this._getOptions();
    this._refreshGpuAcceleration();
  }
  _getOptions() {
    const o = this._xterm.raw.options;
    return {
      cursorInactiveStyle: "none",
      scrollback: 0,
      logLevel: "off",
      theme: this._getTheme(false),
      documentOverride: o.documentOverride,
      fontFamily: o.fontFamily,
      fontWeight: o.fontWeight,
      fontWeightBold: o.fontWeightBold,
      fontSize: o.fontSize,
      letterSpacing: o.letterSpacing,
      lineHeight: o.lineHeight,
      drawBoldTextInBrightColors: o.drawBoldTextInBrightColors,
      minimumContrastRatio: o.minimumContrastRatio,
      tabStopWidth: o.tabStopWidth
    };
  }
  async _refreshGpuAcceleration() {
    if (this._shouldLoadWebgl() && (!this._webglAddon.value || this._webglAddonCustomGlyphs !== this._terminalConfigurationService.config.customGlyphs)) {
      const WebglAddon = await this._xtermAddonLoader.importAddon("webgl");
      if (this._store.isDisposed) {
        return;
      }
      this._webglAddon.value = new WebglAddon({
        customGlyphs: this._terminalConfigurationService.config.customGlyphs
      });
      this._webglAddonCustomGlyphs = this._terminalConfigurationService.config.customGlyphs;
      this._stickyScrollOverlay?.loadAddon(this._webglAddon.value);
    } else if (!this._shouldLoadWebgl() && this._webglAddon.value) {
      this._webglAddon.clear();
    }
  }
  _shouldLoadWebgl() {
    return this._terminalConfigurationService.config.gpuAcceleration === "auto" || this._terminalConfigurationService.config.gpuAcceleration === "on";
  }
  _getTheme(isHovering) {
    const theme = this._themeService.getColorTheme();
    return {
      ...this._xterm.getXtermTheme(),
      background: isHovering ? theme.getColor(terminalStickyScrollHoverBackground)?.toString() ?? this._xtermColorProvider.getBackgroundColor(theme)?.toString() : theme.getColor(terminalStickyScrollBackground)?.toString() ?? this._xtermColorProvider.getBackgroundColor(theme)?.toString(),
      selectionBackground: void 0,
      selectionInactiveBackground: void 0
    };
  }
  _isIgnoredCommand(command) {
    if (!command.command) {
      return false;
    }
    const trimmedCommand = command.command.trim().toLowerCase();
    return this._ignoredCommands.some((cmd) => cmd.toLowerCase() === trimmedCommand);
  }
};
__decorateClass([
  debounce(100)
], TerminalStickyScrollOverlay.prototype, "_show", 1);
__decorateClass([
  throttle(0)
], TerminalStickyScrollOverlay.prototype, "_syncOptions", 1);
__decorateClass([
  throttle(0)
], TerminalStickyScrollOverlay.prototype, "_refreshGpuAcceleration", 1);
TerminalStickyScrollOverlay = __decorateClass([
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, ITerminalConfigurationService),
  __decorateParam(11, IThemeService)
], TerminalStickyScrollOverlay);
function lineStartsWith(line, text) {
  if (!line) {
    return false;
  }
  for (let i = 0; i < text.length; i++) {
    if (line.getCell(i)?.getChars() !== text[i]) {
      return false;
    }
  }
  return true;
}
export {
  TerminalStickyScrollOverlay
};
