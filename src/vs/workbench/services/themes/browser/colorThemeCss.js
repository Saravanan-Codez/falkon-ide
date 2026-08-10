import { asCssVariableName, getColorRegistry } from "../../../../platform/theme/common/colorRegistry.js";
import { asCssVariableName as asSizeCssVariableName, getSizeRegistry, sizeValueToCss } from "../../../../platform/theme/common/sizeRegistry.js";
function generateColorThemeCSS(theme, scopeSelector, themingParticipants, environmentService) {
  const cssRules = /* @__PURE__ */ new Set();
  const ruleCollector = {
    addRule: (rule) => {
      if (!cssRules.has(rule)) {
        cssRules.add(rule);
      }
    }
  };
  ruleCollector.addRule(`${scopeSelector} { forced-color-adjust: none; }`);
  if (themingParticipants && environmentService) {
    for (const participant of themingParticipants) {
      participant(theme, ruleCollector, environmentService);
    }
  }
  const variables = [];
  for (const item of getColorRegistry().getColors()) {
    const color = theme.getColor(item.id, true);
    if (color) {
      variables.push(`${asCssVariableName(item.id)}: ${color.toString()};`);
    }
  }
  for (const item of getSizeRegistry().getSizes()) {
    const sizeValue = getSizeRegistry().resolveDefaultSize(item.id, theme);
    if (sizeValue) {
      variables.push(`${asSizeCssVariableName(item.id)}: ${sizeValueToCss(sizeValue)};`);
    }
  }
  ruleCollector.addRule(`${scopeSelector} { ${variables.join("\n")} }`);
  return new CSSValue([...cssRules].join("\n"));
}
class CSSValue {
  constructor(code) {
    this.code = code;
  }
}
export {
  CSSValue,
  generateColorThemeCSS
};
