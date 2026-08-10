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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ITerminalLogService, TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
let BufferContentTracker = class extends Disposable {
  constructor(_xterm, _configurationService, _logService) {
    super();
    this._xterm = _xterm;
    this._configurationService = _configurationService;
    this._logService = _logService;
    /**
     * The number of wrapped lines in the viewport when the last cached marker was set
     */
    this._priorEditorViewportLineCount = 0;
    this._lines = [];
    this.bufferToEditorLineMapping = /* @__PURE__ */ new Map();
  }
  get lines() {
    return this._lines;
  }
  reset() {
    this._lines = [];
    this._lastCachedMarker = void 0;
    this.update();
  }
  update() {
    if (this._lastCachedMarker?.isDisposed) {
      this._lines = [];
      this._lastCachedMarker = void 0;
    }
    this._removeViewportContent();
    this._updateCachedContent();
    this._updateViewportContent();
    this._lastCachedMarker = this._register(this._xterm.raw.registerMarker());
    this._logService.debug("Buffer content tracker: set ", this._lines.length, " lines");
  }
  _updateCachedContent() {
    const buffer = this._xterm.raw.buffer.active;
    const start = this._lastCachedMarker?.line ? this._lastCachedMarker.line - this._xterm.raw.rows + 1 : 0;
    const end = buffer.baseY;
    if (start < 0 || start > end) {
      return;
    }
    const scrollback = this._configurationService.getValue(TerminalSettingId.Scrollback);
    const maxBufferSize = scrollback + this._xterm.raw.rows - 1;
    const linesToAdd = end - start;
    if (linesToAdd + this._lines.length > maxBufferSize) {
      const numToRemove = linesToAdd + this._lines.length - maxBufferSize;
      for (let i = 0; i < numToRemove; i++) {
        this._lines.shift();
      }
      this._logService.debug("Buffer content tracker: removed ", numToRemove, " lines from top of cached lines, now ", this._lines.length, " lines");
    }
    const cachedLines = [];
    let currentLine = "";
    for (let i = start; i < end; i++) {
      const line = buffer.getLine(i);
      if (!line) {
        continue;
      }
      this.bufferToEditorLineMapping.set(i, this._lines.length + cachedLines.length);
      const isWrapped = buffer.getLine(i + 1)?.isWrapped;
      currentLine += line.translateToString(!isWrapped);
      if (currentLine && !isWrapped || i === buffer.baseY + this._xterm.raw.rows - 1) {
        if (line.length) {
          cachedLines.push(currentLine);
          currentLine = "";
        }
      }
    }
    this._logService.debug("Buffer content tracker:", cachedLines.length, " lines cached");
    this._lines.push(...cachedLines);
  }
  _removeViewportContent() {
    if (!this._lines.length) {
      return;
    }
    let linesToRemove = this._priorEditorViewportLineCount;
    let index = 1;
    while (linesToRemove) {
      this.bufferToEditorLineMapping.forEach((value, key) => {
        if (value === this._lines.length - index) {
          this.bufferToEditorLineMapping.delete(key);
        }
      });
      this._lines.pop();
      index++;
      linesToRemove--;
    }
    this._logService.debug("Buffer content tracker: removed lines from viewport, now ", this._lines.length, " lines cached");
  }
  _updateViewportContent() {
    const buffer = this._xterm.raw.buffer.active;
    this._priorEditorViewportLineCount = 0;
    let currentLine = "";
    for (let i = buffer.baseY; i < buffer.baseY + this._xterm.raw.rows; i++) {
      const line = buffer.getLine(i);
      if (!line) {
        continue;
      }
      this.bufferToEditorLineMapping.set(i, this._lines.length);
      const isWrapped = buffer.getLine(i + 1)?.isWrapped;
      currentLine += line.translateToString(!isWrapped);
      if (currentLine && !isWrapped || i === buffer.baseY + this._xterm.raw.rows - 1) {
        if (currentLine.length) {
          this._priorEditorViewportLineCount++;
          this._lines.push(currentLine);
          currentLine = "";
        }
      }
    }
    this._logService.debug("Viewport content update complete, ", this._lines.length, " lines in the viewport");
  }
};
BufferContentTracker = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ITerminalLogService)
], BufferContentTracker);
export {
  BufferContentTracker
};
