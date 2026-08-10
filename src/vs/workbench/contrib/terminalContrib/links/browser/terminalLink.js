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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import * as dom from "../../../../../base/browser/dom.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { convertBufferRangeToViewport } from "./terminalLinkHelpers.js";
import { isMacintosh } from "../../../../../base/common/platform.js";
import { Emitter } from "../../../../../base/common/event.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
let TerminalLink = class extends Disposable {
  constructor(_xterm, range, text, uri, parsedLink, actions, _viewportY, _activateCallback, _tooltipCallback, _isHighConfidenceLink, label, _type, _configurationService) {
    super();
    this._xterm = _xterm;
    this.range = range;
    this.text = text;
    this.uri = uri;
    this.parsedLink = parsedLink;
    this.actions = actions;
    this._viewportY = _viewportY;
    this._activateCallback = _activateCallback;
    this._tooltipCallback = _tooltipCallback;
    this._isHighConfidenceLink = _isHighConfidenceLink;
    this.label = label;
    this._type = _type;
    this._configurationService = _configurationService;
    this._tooltipScheduler = this._register(new MutableDisposable());
    this._hoverListeners = this._register(new MutableDisposable());
    this._onInvalidated = this._register(new Emitter());
    this.decorations = {
      pointerCursor: false,
      underline: this._isHighConfidenceLink
    };
  }
  get onInvalidated() {
    return this._onInvalidated.event;
  }
  get type() {
    return this._type;
  }
  activate(event, text) {
    this._activateCallback(event, text);
  }
  hover(event, text) {
    const w = dom.getWindow(event);
    const d = w.document;
    const hoverListeners = this._hoverListeners.value = new DisposableStore();
    hoverListeners.add(dom.addDisposableListener(d, "keydown", (e) => {
      if (!e.repeat && this._isModifierDown(e)) {
        this._enableDecorations();
      }
    }));
    hoverListeners.add(dom.addDisposableListener(d, "keyup", (e) => {
      if (!e.repeat && !this._isModifierDown(e)) {
        this._disableDecorations();
      }
    }));
    hoverListeners.add(this._xterm.onRender((e) => {
      const viewportRangeY = this.range.start.y - this._viewportY;
      if (viewportRangeY >= e.start && viewportRangeY <= e.end) {
        this._onInvalidated.fire();
      }
    }));
    if (this._isHighConfidenceLink) {
      this._tooltipScheduler.value = new RunOnceScheduler(() => {
        this._tooltipCallback(
          this,
          convertBufferRangeToViewport(this.range, this._viewportY),
          this._isHighConfidenceLink ? () => this._enableDecorations() : void 0,
          this._isHighConfidenceLink ? () => this._disableDecorations() : void 0
        );
        this._tooltipScheduler.clear();
      }, this._configurationService.getValue("workbench.hover.delay"));
      this._tooltipScheduler.value.schedule();
    }
    const origin = { x: event.pageX, y: event.pageY };
    hoverListeners.add(dom.addDisposableListener(d, dom.EventType.MOUSE_MOVE, (e) => {
      if (this._isModifierDown(e)) {
        this._enableDecorations();
      } else {
        this._disableDecorations();
      }
      if (Math.abs(e.pageX - origin.x) > w.devicePixelRatio * 2 || Math.abs(e.pageY - origin.y) > w.devicePixelRatio * 2) {
        origin.x = e.pageX;
        origin.y = e.pageY;
        this._tooltipScheduler.value?.schedule();
      }
    }));
  }
  leave() {
    this._hoverListeners.clear();
    this._tooltipScheduler.clear();
  }
  _enableDecorations() {
    if (!this.decorations.pointerCursor) {
      this.decorations.pointerCursor = true;
    }
    if (!this.decorations.underline) {
      this.decorations.underline = true;
    }
  }
  _disableDecorations() {
    if (this.decorations.pointerCursor) {
      this.decorations.pointerCursor = false;
    }
    if (this.decorations.underline !== this._isHighConfidenceLink) {
      this.decorations.underline = this._isHighConfidenceLink;
    }
  }
  _isModifierDown(event) {
    const multiCursorModifier = this._configurationService.getValue("editor.multiCursorModifier");
    if (multiCursorModifier === "ctrlCmd") {
      return !!event.altKey;
    }
    return isMacintosh ? event.metaKey : event.ctrlKey;
  }
};
TerminalLink = __decorateClass([
  __decorateParam(12, IConfigurationService)
], TerminalLink);
export {
  TerminalLink
};
