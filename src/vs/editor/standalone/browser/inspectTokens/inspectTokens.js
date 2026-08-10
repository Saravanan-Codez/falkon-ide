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
import "./inspectTokens.css";
import { $, append, reset } from "../../../../base/browser/dom.js";
import { CharCode } from "../../../../base/common/charCode.js";
import { Color } from "../../../../base/common/color.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EditorAction, registerEditorAction, registerEditorContribution, EditorContributionInstantiation } from "../../../browser/editorExtensions.js";
import { TokenizationRegistry } from "../../../common/languages.js";
import { FontStyle, StandardTokenType, TokenMetadata } from "../../../common/encodedTokenAttributes.js";
import { NullState, nullTokenize, nullTokenizeEncoded } from "../../../common/languages/nullTokenize.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { IStandaloneThemeService } from "../../common/standaloneTheme.js";
import { InspectTokensNLS } from "../../../common/standaloneStrings.js";
let InspectTokensController = class extends Disposable {
  static {
    this.ID = "editor.contrib.inspectTokens";
  }
  static get(editor) {
    return editor.getContribution(InspectTokensController.ID);
  }
  constructor(editor, standaloneColorService, languageService) {
    super();
    this._editor = editor;
    this._languageService = languageService;
    this._widget = null;
    this._register(this._editor.onDidChangeModel((e) => this.stop()));
    this._register(this._editor.onDidChangeModelLanguage((e) => this.stop()));
    this._register(TokenizationRegistry.onDidChange((e) => this.stop()));
    this._register(this._editor.onKeyUp((e) => e.keyCode === KeyCode.Escape && this.stop()));
  }
  dispose() {
    this.stop();
    super.dispose();
  }
  launch() {
    if (this._widget) {
      return;
    }
    if (!this._editor.hasModel()) {
      return;
    }
    this._widget = new InspectTokensWidget(this._editor, this._languageService);
  }
  stop() {
    if (this._widget) {
      this._widget.dispose();
      this._widget = null;
    }
  }
};
InspectTokensController = __decorateClass([
  __decorateParam(1, IStandaloneThemeService),
  __decorateParam(2, ILanguageService)
], InspectTokensController);
class InspectTokens extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inspectTokens",
      label: InspectTokensNLS.inspectTokensAction,
      alias: "Developer: Inspect Tokens",
      precondition: void 0
    });
  }
  run(accessor, editor) {
    const controller = InspectTokensController.get(editor);
    controller?.launch();
  }
}
function renderTokenText(tokenText) {
  let result = "";
  for (let charIndex = 0, len = tokenText.length; charIndex < len; charIndex++) {
    const charCode = tokenText.charCodeAt(charIndex);
    switch (charCode) {
      case CharCode.Tab:
        result += "\u2192";
        break;
      case CharCode.Space:
        result += "\xB7";
        break;
      default:
        result += String.fromCharCode(charCode);
    }
  }
  return result;
}
function getSafeTokenizationSupport(languageIdCodec, languageId) {
  const tokenizationSupport = TokenizationRegistry.get(languageId);
  if (tokenizationSupport) {
    return tokenizationSupport;
  }
  const encodedLanguageId = languageIdCodec.encodeLanguageId(languageId);
  return {
    getInitialState: () => NullState,
    tokenize: (line, hasEOL, state) => nullTokenize(languageId, state),
    tokenizeEncoded: (line, hasEOL, state) => nullTokenizeEncoded(encodedLanguageId, state)
  };
}
class InspectTokensWidget extends Disposable {
  constructor(editor, languageService) {
    super();
    // Editor.IContentWidget.allowEditorOverflow
    this.allowEditorOverflow = true;
    this._editor = editor;
    this._languageService = languageService;
    this._model = this._editor.getModel();
    this._domNode = document.createElement("div");
    this._domNode.className = "tokens-inspect-widget";
    this._tokenizationSupport = getSafeTokenizationSupport(this._languageService.languageIdCodec, this._model.getLanguageId());
    this._compute(this._editor.getPosition());
    this._register(this._editor.onDidChangeCursorPosition((e) => this._compute(this._editor.getPosition())));
    this._editor.addContentWidget(this);
  }
  static {
    this._ID = "editor.contrib.inspectTokensWidget";
  }
  dispose() {
    this._editor.removeContentWidget(this);
    super.dispose();
  }
  getId() {
    return InspectTokensWidget._ID;
  }
  _compute(position) {
    const data = this._getTokensAtLine(position.lineNumber);
    let token1Index = 0;
    for (let i = data.tokens1.length - 1; i >= 0; i--) {
      const t = data.tokens1[i];
      if (position.column - 1 >= t.offset) {
        token1Index = i;
        break;
      }
    }
    let token2Index = 0;
    for (let i = data.tokens2.length >>> 1; i >= 0; i--) {
      if (position.column - 1 >= data.tokens2[i << 1]) {
        token2Index = i;
        break;
      }
    }
    const lineContent = this._model.getLineContent(position.lineNumber);
    let tokenText = "";
    if (token1Index < data.tokens1.length) {
      const tokenStartIndex = data.tokens1[token1Index].offset;
      const tokenEndIndex = token1Index + 1 < data.tokens1.length ? data.tokens1[token1Index + 1].offset : lineContent.length;
      tokenText = lineContent.substring(tokenStartIndex, tokenEndIndex);
    }
    reset(
      this._domNode,
      $(
        "h2.tm-token",
        void 0,
        renderTokenText(tokenText),
        $("span.tm-token-length", void 0, `${tokenText.length} ${tokenText.length === 1 ? "char" : "chars"}`)
      )
    );
    append(this._domNode, $("hr.tokens-inspect-separator", { "style": "clear:both" }));
    const metadata = (token2Index << 1) + 1 < data.tokens2.length ? this._decodeMetadata(data.tokens2[(token2Index << 1) + 1]) : null;
    append(this._domNode, $(
      "table.tm-metadata-table",
      void 0,
      $(
        "tbody",
        void 0,
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "language"),
          $("td.tm-metadata-value", void 0, `${metadata ? metadata.languageId : "-?-"}`)
        ),
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "token type"),
          $("td.tm-metadata-value", void 0, `${metadata ? this._tokenTypeToString(metadata.tokenType) : "-?-"}`)
        ),
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "font style"),
          $("td.tm-metadata-value", void 0, `${metadata ? this._fontStyleToString(metadata.fontStyle) : "-?-"}`)
        ),
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "foreground"),
          $("td.tm-metadata-value", void 0, `${metadata ? Color.Format.CSS.formatHex(metadata.foreground) : "-?-"}`)
        ),
        $(
          "tr",
          void 0,
          $("td.tm-metadata-key", void 0, "background"),
          $("td.tm-metadata-value", void 0, `${metadata ? Color.Format.CSS.formatHex(metadata.background) : "-?-"}`)
        )
      )
    ));
    append(this._domNode, $("hr.tokens-inspect-separator"));
    if (token1Index < data.tokens1.length) {
      append(this._domNode, $("span.tm-token-type", void 0, data.tokens1[token1Index].type));
    }
    this._editor.layoutContentWidget(this);
  }
  _decodeMetadata(metadata) {
    const colorMap = TokenizationRegistry.getColorMap();
    const languageId = TokenMetadata.getLanguageId(metadata);
    const tokenType = TokenMetadata.getTokenType(metadata);
    const fontStyle = TokenMetadata.getFontStyle(metadata);
    const foreground = TokenMetadata.getForeground(metadata);
    const background = TokenMetadata.getBackground(metadata);
    return {
      languageId: this._languageService.languageIdCodec.decodeLanguageId(languageId),
      tokenType,
      fontStyle,
      foreground: colorMap[foreground],
      background: colorMap[background]
    };
  }
  _tokenTypeToString(tokenType) {
    switch (tokenType) {
      case StandardTokenType.Other:
        return "Other";
      case StandardTokenType.Comment:
        return "Comment";
      case StandardTokenType.String:
        return "String";
      case StandardTokenType.RegEx:
        return "RegEx";
      default:
        return "??";
    }
  }
  _fontStyleToString(fontStyle) {
    let r = "";
    if (fontStyle & FontStyle.Italic) {
      r += "italic ";
    }
    if (fontStyle & FontStyle.Bold) {
      r += "bold ";
    }
    if (fontStyle & FontStyle.Underline) {
      r += "underline ";
    }
    if (fontStyle & FontStyle.Strikethrough) {
      r += "strikethrough ";
    }
    if (r.length === 0) {
      r = "---";
    }
    return r;
  }
  _getTokensAtLine(lineNumber) {
    const stateBeforeLine = this._getStateBeforeLine(lineNumber);
    const tokenizationResult1 = this._tokenizationSupport.tokenize(this._model.getLineContent(lineNumber), true, stateBeforeLine);
    const tokenizationResult2 = this._tokenizationSupport.tokenizeEncoded(this._model.getLineContent(lineNumber), true, stateBeforeLine);
    return {
      startState: stateBeforeLine,
      tokens1: tokenizationResult1.tokens,
      tokens2: tokenizationResult2.tokens,
      endState: tokenizationResult1.endState
    };
  }
  _getStateBeforeLine(lineNumber) {
    let state = this._tokenizationSupport.getInitialState();
    for (let i = 1; i < lineNumber; i++) {
      const tokenizationResult = this._tokenizationSupport.tokenize(this._model.getLineContent(i), true, state);
      state = tokenizationResult.endState;
    }
    return state;
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return {
      position: this._editor.getPosition(),
      preference: [ContentWidgetPositionPreference.BELOW, ContentWidgetPositionPreference.ABOVE]
    };
  }
}
registerEditorContribution(InspectTokensController.ID, InspectTokensController, EditorContributionInstantiation.Lazy);
registerEditorAction(InspectTokens);
