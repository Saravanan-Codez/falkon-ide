import { $, getActiveDocument, getActiveWindow } from "../../../../base/browser/dom.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import "./media/decorationCssRuleExtractor.css";
class DecorationCssRuleExtractor extends Disposable {
  constructor() {
    super();
    this._ruleCache = /* @__PURE__ */ new Map();
    this._cssVariableCache = /* @__PURE__ */ new Map();
    this._container = $("div.monaco-decoration-css-rule-extractor");
    this._dummyElement = $("span");
    this._container.appendChild(this._dummyElement);
    this._register(toDisposable(() => this._container.remove()));
  }
  getStyleRules(canvas, decorationClassName) {
    const existing = this._ruleCache.get(decorationClassName);
    if (existing) {
      return existing;
    }
    this._dummyElement.className = decorationClassName;
    canvas.appendChild(this._container);
    const rules = this._getStyleRules(decorationClassName);
    this._ruleCache.set(decorationClassName, rules);
    canvas.removeChild(this._container);
    return rules;
  }
  _getStyleRules(className) {
    const rules = [];
    const doc = getActiveDocument();
    const stylesheets = [...doc.styleSheets];
    const classNames = className.split(" ").filter((c) => c.length > 0);
    for (let i = 0; i < stylesheets.length; i++) {
      const stylesheet = stylesheets[i];
      this._collectMatchingRules(stylesheet.cssRules, classNames, rules);
    }
    return rules;
  }
  _collectMatchingRules(cssRules, classNames, result) {
    for (const rule of cssRules) {
      if (rule instanceof CSSImportRule) {
        if (rule.styleSheet) {
          this._collectMatchingRules(rule.styleSheet.cssRules, classNames, result);
        }
      } else if (rule instanceof CSSStyleRule) {
        for (const className of classNames) {
          const searchTerm = `.${className}`;
          const index = rule.selectorText.indexOf(searchTerm);
          if (index !== -1) {
            const endOfResult = index + searchTerm.length;
            if (rule.selectorText.length === endOfResult || rule.selectorText.substring(endOfResult, endOfResult + 1).match(/[ :.]/)) {
              result.push(rule);
              break;
            }
          }
        }
        if (rule.cssRules?.length) {
          this._collectMatchingRules(rule.cssRules, classNames, result);
        }
      }
    }
  }
  /**
   * Resolves a CSS variable to its computed value using the container element.
   */
  resolveCssVariable(canvas, variableName) {
    let result = this._cssVariableCache.get(variableName);
    if (result === void 0) {
      canvas.appendChild(this._container);
      result = getActiveWindow().getComputedStyle(this._container).getPropertyValue(variableName).trim();
      canvas.removeChild(this._container);
      this._cssVariableCache.set(variableName, result);
    }
    return result;
  }
  /**
   * Clears all cached CSS rules and CSS variable values. This should be called when the theme
   * changes to ensure fresh values are computed.
   */
  clear() {
    this._ruleCache.clear();
    this._cssVariableCache.clear();
  }
}
export {
  DecorationCssRuleExtractor
};
