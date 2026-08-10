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
import { URI } from "../../../base/common/uri.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { MainContext, ExtHostContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { Range } from "../../../editor/common/core/range.js";
import { TokenMetadata, FontStyle } from "../../../editor/common/encodedTokenAttributes.js";
import { TokenizationRegistry } from "../../../editor/common/languages.js";
import { Color } from "../../../base/common/color.js";
import { ITextModelService } from "../../../editor/common/services/resolverService.js";
import { ILanguageStatusService } from "../../services/languageStatus/common/languageStatusService.js";
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { ITextMateTokenizationService } from "../../services/textMate/browser/textMateTokenizationFeature.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
let MainThreadLanguages = class extends Disposable {
  constructor(_extHostContext, _languageService, _modelService, _resolverService, _languageStatusService, _textMateService, themeService) {
    super();
    this._languageService = _languageService;
    this._modelService = _modelService;
    this._resolverService = _resolverService;
    this._languageStatusService = _languageStatusService;
    this._textMateService = _textMateService;
    this._status = this._register(new DisposableMap());
    this._proxy = _extHostContext.getProxy(ExtHostContext.ExtHostLanguages);
    this._proxy.$acceptLanguageIds(_languageService.getRegisteredLanguageIds());
    this._register(_languageService.onDidChange((_) => {
      this._proxy.$acceptLanguageIds(_languageService.getRegisteredLanguageIds());
    }));
    this._register(themeService.onDidColorThemeChange(() => {
      this._proxy.$acceptSyntaxHighlightingThemeChanged();
    }));
  }
  async $changeLanguage(resource, languageId) {
    if (!this._languageService.isRegisteredLanguageId(languageId)) {
      return Promise.reject(new Error(`Unknown language id: ${languageId}`));
    }
    const uri = URI.revive(resource);
    const ref = await this._resolverService.createModelReference(uri);
    try {
      ref.object.textEditorModel.setLanguage(this._languageService.createById(languageId));
    } finally {
      ref.dispose();
    }
  }
  async $tokensAtPosition(resource, position) {
    const uri = URI.revive(resource);
    const model = this._modelService.getModel(uri);
    if (!model) {
      return void 0;
    }
    model.tokenization.tokenizeIfCheap(position.lineNumber);
    const tokens = model.tokenization.getLineTokens(position.lineNumber);
    const idx = tokens.findTokenIndexAtOffset(position.column - 1);
    return {
      type: tokens.getStandardTokenType(idx),
      range: new Range(position.lineNumber, 1 + tokens.getStartOffset(idx), position.lineNumber, 1 + tokens.getEndOffset(idx))
    };
  }
  async $computeFullSyntaxHighlighting(source, languageId) {
    const colorMap = (TokenizationRegistry.getColorMap() ?? []).map((c) => c ? Color.Format.CSS.formatHexA(c) : "");
    const resolvedLanguageId = this._languageService.isRegisteredLanguageId(languageId) ? languageId : this._languageService.getLanguageIdByLanguageName(languageId);
    const grammar = resolvedLanguageId ? await this._textMateService.createTokenizer(resolvedLanguageId) : null;
    if (!grammar) {
      const tokens2 = source.length === 0 ? [] : [{ length: source.length, foreground: 0, fontStyle: FontStyle.None }];
      return { tokens: tokens2, colorMap };
    }
    const tokens = [];
    const lines = source.split("\n");
    let state = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const result = grammar.tokenizeLine2(line, state, 500);
      state = result.ruleStack;
      const binary = result.tokens;
      for (let j = 0; j < binary.length; j += 2) {
        const startOffset = binary[j];
        const metadata = binary[j + 1];
        const endOffset = j + 2 < binary.length ? binary[j + 2] : line.length;
        if (endOffset > startOffset) {
          tokens.push({
            length: endOffset - startOffset,
            foreground: TokenMetadata.getForeground(metadata),
            fontStyle: TokenMetadata.getFontStyle(metadata)
          });
        }
      }
      if (i < lines.length - 1) {
        tokens.push({ length: 1, foreground: 0, fontStyle: FontStyle.None });
      }
    }
    return { tokens, colorMap };
  }
  // --- language status
  $setLanguageStatus(handle, status) {
    this._status.set(handle, this._languageStatusService.addStatus(status));
  }
  $removeLanguageStatus(handle) {
    this._status.deleteAndDispose(handle);
  }
};
MainThreadLanguages = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadLanguages),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IModelService),
  __decorateParam(3, ITextModelService),
  __decorateParam(4, ILanguageStatusService),
  __decorateParam(5, ITextMateTokenizationService),
  __decorateParam(6, IThemeService)
], MainThreadLanguages);
export {
  MainThreadLanguages
};
