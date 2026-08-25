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
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILanguageService } from "../languages/language.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { SemanticTokensProviderStyling } from "./semanticTokensProviderStyling.js";
import { ISemanticTokensStylingService } from "./semanticTokensStyling.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
let SemanticTokensStylingService = class extends Disposable {
  constructor(_themeService, _logService, _languageService) {
    super();
    this._themeService = _themeService;
    this._logService = _logService;
    this._languageService = _languageService;
    this._caches = /* @__PURE__ */ new WeakMap();
    this._register(this._themeService.onDidColorThemeChange(() => {
      this._caches = /* @__PURE__ */ new WeakMap();
    }));
  }
  getStyling(provider) {
    if (!this._caches.has(provider)) {
      this._caches.set(provider, new SemanticTokensProviderStyling(provider.getLegend(), this._themeService, this._languageService, this._logService));
    }
    return this._caches.get(provider);
  }
};
SemanticTokensStylingService = __decorateClass([
  __decorateParam(0, IThemeService),
  __decorateParam(1, ILogService),
  __decorateParam(2, ILanguageService)
], SemanticTokensStylingService);
registerSingleton(ISemanticTokensStylingService, SemanticTokensStylingService, InstantiationType.Delayed);
export {
  SemanticTokensStylingService
};
