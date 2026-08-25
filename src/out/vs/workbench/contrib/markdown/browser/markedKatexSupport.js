import { importAMDNodeModule, resolveAmdNodeModulePath } from "../../../../amdX.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { katexContainerLatexAttributeName, MarkedKatexExtension } from "../common/markedKatexExtension.js";
class MarkedKatexSupport {
  static getSanitizerOptions(baseConfig) {
    return {
      allowedTags: {
        override: [
          ...baseConfig.allowedTags,
          ...trustedMathMlTags
        ]
      },
      allowedAttributes: {
        override: [
          ...baseConfig.allowedAttributes,
          // Math
          "stretchy",
          "encoding",
          "accent",
          katexContainerLatexAttributeName,
          // SVG
          "d",
          "viewBox",
          "preserveAspectRatio",
          // Allow all classes since we don't have a list of allowed katex classes
          "class",
          // Sanitize allowed styles for katex
          {
            attributeName: "style",
            shouldKeep: (_el, data) => this.sanitizeKatexStyles(data.attrValue)
          }
        ]
      }
    };
  }
  static {
    this.tempSanitizerRule = new Lazy(() => {
      const styleSheet = new CSSStyleSheet();
      styleSheet.insertRule(`.temp{}`);
      const rule = styleSheet.cssRules[0];
      if (!(rule instanceof CSSStyleRule)) {
        throw new Error("Invalid CSS rule");
      }
      return rule.style;
    });
  }
  static sanitizeStyles(styleString, allowedProperties) {
    const style = this.tempSanitizerRule.value;
    style.cssText = styleString;
    const sanitizedProps = [];
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (allowedProperties.includes(prop)) {
        const value = style.getPropertyValue(prop);
        if (/^(([\d\.\-]+\w*\s?)+|\w+)$/.test(value)) {
          sanitizedProps.push(`${prop}: ${value}`);
        }
      }
    }
    return sanitizedProps.join("; ");
  }
  static sanitizeKatexStyles(styleString) {
    const allowedProperties = [
      "display",
      "position",
      "font-family",
      "font-style",
      "font-weight",
      "font-size",
      "height",
      "min-height",
      "max-height",
      "width",
      "min-width",
      "max-width",
      "margin",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "padding",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "top",
      "left",
      "right",
      "bottom",
      "vertical-align",
      "transform",
      "border",
      "border-top-width",
      "border-right-width",
      "border-bottom-width",
      "border-left-width",
      "color",
      "white-space",
      "text-align",
      "line-height",
      "float",
      "clear"
    ];
    return this.sanitizeStyles(styleString, allowedProperties);
  }
  static {
    this._katexPromise = new Lazy(async () => {
      this._katex = await importAMDNodeModule("katex", "dist/katex.min.js");
      return this._katex;
    });
  }
  static getExtension(window, options = {}) {
    if (!this._katex) {
      return void 0;
    }
    this.ensureKatexStyles(window);
    return MarkedKatexExtension.extension(this._katex, options);
  }
  static async loadExtension(window, options = {}) {
    const katex = await this._katexPromise.value;
    this.ensureKatexStyles(window);
    return MarkedKatexExtension.extension(katex, options);
  }
  static ensureKatexStyles(window) {
    const doc = window.document;
    if (!doc.querySelector("link.katex")) {
      const katexStyle = document.createElement("link");
      katexStyle.classList.add("katex");
      katexStyle.rel = "stylesheet";
      katexStyle.href = resolveAmdNodeModulePath("katex", "dist/katex.min.css");
      doc.head.appendChild(katexStyle);
    }
  }
}
const trustedMathMlTags = Object.freeze([
  "semantics",
  "annotation",
  "math",
  "menclose",
  "merror",
  "mfenced",
  "mfrac",
  "mglyph",
  "mi",
  "mlabeledtr",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mroot",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msup",
  "msubsup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "mprescripts",
  // svg tags
  "svg",
  "altglyph",
  "altglyphdef",
  "altglyphitem",
  "circle",
  "clippath",
  "defs",
  "desc",
  "ellipse",
  "filter",
  "font",
  "g",
  "glyph",
  "glyphref",
  "hkern",
  "line",
  "lineargradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "stop",
  "style",
  "switch",
  "symbol",
  "text",
  "textpath",
  "title",
  "tref",
  "tspan",
  "view",
  "vkern"
]);
export {
  MarkedKatexSupport
};
