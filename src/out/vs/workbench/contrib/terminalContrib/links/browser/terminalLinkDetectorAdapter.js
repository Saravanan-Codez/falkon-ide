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
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { TerminalLink } from "./terminalLink.js";
let TerminalLinkDetectorAdapter = class extends Disposable {
  constructor(_detector, _instantiationService) {
    super();
    this._detector = _detector;
    this._instantiationService = _instantiationService;
    this._activeLinksStore = this._register(new DisposableStore());
    this._onDidActivateLink = this._register(new Emitter());
    this.onDidActivateLink = this._onDidActivateLink.event;
    this._onDidShowHover = this._register(new Emitter());
    this.onDidShowHover = this._onDidShowHover.event;
    this._activeProvideLinkRequests = /* @__PURE__ */ new Map();
  }
  async provideLinks(bufferLineNumber, callback) {
    let activeRequest = this._activeProvideLinkRequests.get(bufferLineNumber);
    if (activeRequest) {
      const links2 = await activeRequest;
      callback(links2);
      return;
    }
    this._activeLinksStore.clear();
    activeRequest = this._provideLinks(bufferLineNumber);
    this._activeProvideLinkRequests.set(bufferLineNumber, activeRequest);
    const links = await activeRequest;
    this._activeProvideLinkRequests.delete(bufferLineNumber);
    callback(links);
  }
  async _provideLinks(bufferLineNumber) {
    const links = [];
    let startLine = bufferLineNumber - 1;
    let endLine = startLine;
    const lines = [
      this._detector.xterm.buffer.active.getLine(startLine)
    ];
    const maxCharacterContext = Math.max(this._detector.maxLinkLength, this._detector.xterm.cols);
    const maxLineContext = Math.ceil(maxCharacterContext / this._detector.xterm.cols);
    const minStartLine = Math.max(startLine - maxLineContext, 0);
    const maxEndLine = Math.min(endLine + maxLineContext, this._detector.xterm.buffer.active.length);
    while (startLine >= minStartLine && this._detector.xterm.buffer.active.getLine(startLine)?.isWrapped) {
      lines.unshift(this._detector.xterm.buffer.active.getLine(startLine - 1));
      startLine--;
    }
    while (endLine < maxEndLine && this._detector.xterm.buffer.active.getLine(endLine + 1)?.isWrapped) {
      lines.push(this._detector.xterm.buffer.active.getLine(endLine + 1));
      endLine++;
    }
    const detectedLinks = await this._detector.detect(lines, startLine, endLine);
    if (this._store.isDisposed) {
      return [];
    }
    for (const link of detectedLinks) {
      const terminalLink = this._createTerminalLink(link, async (event) => this._onDidActivateLink.fire({ link, event }));
      links.push(terminalLink);
      this._activeLinksStore.add(terminalLink);
    }
    return links;
  }
  _createTerminalLink(l, activateCallback) {
    if (!l.disableTrimColon && l.text.length > 0 && l.text.charAt(l.text.length - 1) === ":") {
      l.text = l.text.slice(0, -1);
      l.bufferRange.end.x--;
    }
    return this._instantiationService.createInstance(
      TerminalLink,
      this._detector.xterm,
      l.bufferRange,
      l.text,
      l.uri,
      l.parsedLink,
      l.actions,
      this._detector.xterm.buffer.active.viewportY,
      activateCallback,
      (link, viewportRange, modifierDownCallback, modifierUpCallback) => this._onDidShowHover.fire({
        link,
        viewportRange,
        modifierDownCallback,
        modifierUpCallback
      }),
      l.type !== TerminalBuiltinLinkType.Search,
      // Only search is low confidence
      l.label || this._getLabel(l.type),
      l.type
    );
  }
  _getLabel(type) {
    switch (type) {
      case TerminalBuiltinLinkType.Search:
        return localize("searchWorkspace", "Search workspace");
      case TerminalBuiltinLinkType.LocalFile:
        return localize("openFile", "Open file in editor");
      case TerminalBuiltinLinkType.LocalFolderInWorkspace:
        return localize("focusFolder", "Focus folder in explorer");
      case TerminalBuiltinLinkType.LocalFolderOutsideWorkspace:
        return localize("openFolder", "Open folder in new window");
      case TerminalBuiltinLinkType.Url:
      default:
        return localize("followLink", "Follow link");
    }
  }
};
TerminalLinkDetectorAdapter = __decorateClass([
  __decorateParam(1, IInstantiationService)
], TerminalLinkDetectorAdapter);
export {
  TerminalLinkDetectorAdapter
};
