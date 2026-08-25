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
import { escapeRegExpCharacters } from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { matchesScheme } from "../../../../../base/common/network.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { convertLinkRangeToBuffer, getXtermLineContent } from "./terminalLinkHelpers.js";
import { TERMINAL_CONFIG_SECTION } from "../../../terminal/common/terminal.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxLineLength"] = 2e3] = "MaxLineLength";
  return Constants2;
})(Constants || {});
let TerminalWordLinkDetector = class extends Disposable {
  constructor(xterm, _configurationService, _productService) {
    super();
    this.xterm = xterm;
    this._configurationService = _configurationService;
    this._productService = _productService;
    // Word links typically search the workspace so it makes sense that their maximum link length is
    // quite small.
    this.maxLinkLength = 100;
    this._refreshSeparatorCodes();
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.WordSeparators)) {
        this._refreshSeparatorCodes();
      }
    }));
  }
  static {
    this.id = "word";
  }
  detect(lines, startLine, endLine) {
    const links = [];
    const text = getXtermLineContent(this.xterm.buffer.active, startLine, endLine, this.xterm.cols);
    if (text === "" || text.length > 2e3 /* MaxLineLength */) {
      return [];
    }
    const words = this._parseWords(text);
    for (const word of words) {
      if (word.text === "") {
        continue;
      }
      if (word.text.length > 0 && word.text.charAt(word.text.length - 1) === ":") {
        word.text = word.text.slice(0, -1);
        word.endIndex--;
      }
      const bufferRange = convertLinkRangeToBuffer(
        lines,
        this.xterm.cols,
        {
          startColumn: word.startIndex + 1,
          startLineNumber: 1,
          endColumn: word.endIndex + 1,
          endLineNumber: 1
        },
        startLine
      );
      if (matchesScheme(word.text, this._productService.urlProtocol)) {
        const uri = URI.parse(word.text);
        if (uri) {
          links.push({
            text: word.text,
            uri,
            bufferRange,
            type: TerminalBuiltinLinkType.Url
          });
        }
        continue;
      }
      links.push({
        text: word.text,
        bufferRange,
        type: TerminalBuiltinLinkType.Search,
        contextLine: text
      });
    }
    return links;
  }
  _parseWords(text) {
    const words = [];
    const splitWords = text.split(this._separatorRegex);
    let runningIndex = 0;
    for (let i = 0; i < splitWords.length; i++) {
      words.push({
        text: splitWords[i],
        startIndex: runningIndex,
        endIndex: runningIndex + splitWords[i].length
      });
      runningIndex += splitWords[i].length + 1;
    }
    return words;
  }
  _refreshSeparatorCodes() {
    const separators = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).wordSeparators;
    let powerlineSymbols = "";
    for (let i = 57520; i <= 57535; i++) {
      powerlineSymbols += String.fromCharCode(i);
    }
    this._separatorRegex = new RegExp(`[${escapeRegExpCharacters(separators)}${powerlineSymbols}]`, "g");
  }
};
TerminalWordLinkDetector = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IProductService)
], TerminalWordLinkDetector);
export {
  TerminalWordLinkDetector
};
