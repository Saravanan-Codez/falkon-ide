const inheritableCSSProperties = /* @__PURE__ */ new Set([
  "color",
  "cursor",
  "direction",
  "font",
  "font-family",
  "font-feature-settings",
  "font-kerning",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "letter-spacing",
  "line-height",
  "list-style",
  "list-style-image",
  "list-style-position",
  "list-style-type",
  "orphans",
  "overflow-wrap",
  "quotes",
  "tab-size",
  "text-align",
  "text-align-last",
  "text-indent",
  "text-transform",
  "visibility",
  "white-space",
  "widows",
  "word-break",
  "word-spacing",
  "writing-mode"
]);
const varReferenceRegex = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
const keyComputedProperties = /* @__PURE__ */ new Set([
  "display",
  "position",
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
  "font-size",
  "font-family",
  "color",
  "background-color"
]);
const alwaysResolvedProperties = /* @__PURE__ */ new Set(["display", "height", "width"]);
function collectVarReferences(value, into) {
  for (const m of value.matchAll(varReferenceRegex)) {
    into.add(m[1]);
  }
}
function collectPropertyNames(cssProperties, into, inheritableOnly) {
  for (const prop of cssProperties) {
    if (!prop.name || !prop.value || prop.disabled || prop.name.startsWith("--")) {
      continue;
    }
    if (inheritableOnly && !inheritableCSSProperties.has(prop.name)) {
      continue;
    }
    into.add(prop.name);
  }
}
function filterInheritableDeclarations(cssText) {
  const declarations = cssText.split(";").map((d) => d.trim()).filter(Boolean);
  const filtered = declarations.filter((decl) => {
    const colonIdx = decl.indexOf(":");
    if (colonIdx === -1) {
      return false;
    }
    const propName = decl.substring(0, colonIdx).trim();
    return inheritableCSSProperties.has(propName);
  });
  return filtered.length > 0 ? filtered.join("; ") : void 0;
}
function formatMatchedStyles(matched) {
  const referencedVars = /* @__PURE__ */ new Set();
  const authorPropertyNames = /* @__PURE__ */ new Set();
  const userAgentPropertyNames = /* @__PURE__ */ new Set();
  const seenCssTexts = /* @__PURE__ */ new Set();
  const lines = [];
  if (matched.inlineStyle?.cssText?.trim()) {
    const cssText = matched.inlineStyle.cssText.trim();
    collectVarReferences(cssText, referencedVars);
    collectPropertyNames(matched.inlineStyle.cssProperties, authorPropertyNames);
    lines.push(`element { ${cssText} }`);
  }
  for (const ruleEntry of matched.matchedCSSRules ?? []) {
    if (ruleEntry.rule.origin === "user-agent") {
      collectPropertyNames(ruleEntry.rule.style.cssProperties, userAgentPropertyNames);
      continue;
    }
    const cssText = ruleEntry.rule.style.cssText?.trim();
    if (!cssText || seenCssTexts.has(cssText)) {
      continue;
    }
    seenCssTexts.add(cssText);
    collectVarReferences(cssText, referencedVars);
    collectPropertyNames(ruleEntry.rule.style.cssProperties, authorPropertyNames);
    const selectors = ruleEntry.rule.selectorList.selectors.map((s) => s.text).join(", ");
    lines.push(`${selectors} { ${cssText} }`);
  }
  if (matched.pseudoElements?.length) {
    const pseudoLines = [];
    for (const pseudo of matched.pseudoElements) {
      for (const ruleEntry of pseudo.matches ?? []) {
        if (ruleEntry.rule.origin === "user-agent") {
          collectPropertyNames(ruleEntry.rule.style.cssProperties, userAgentPropertyNames);
          continue;
        }
        const cssText = ruleEntry.rule.style.cssText?.trim();
        if (!cssText || seenCssTexts.has(cssText)) {
          continue;
        }
        seenCssTexts.add(cssText);
        collectVarReferences(cssText, referencedVars);
        collectPropertyNames(ruleEntry.rule.style.cssProperties, authorPropertyNames);
        const selectors = ruleEntry.rule.selectorList.selectors.map((s) => s.text).join(", ");
        pseudoLines.push(`${selectors} { ${cssText} }`);
      }
    }
    if (pseudoLines.length > 0) {
      lines.push("");
      lines.push("/* Pseudo-elements */");
      lines.push(...pseudoLines);
    }
  }
  const inheritedLines = [];
  for (const entry of matched.inherited ?? []) {
    for (const ruleEntry of entry.matchedCSSRules ?? []) {
      if (ruleEntry.rule.origin === "user-agent") {
        collectPropertyNames(ruleEntry.rule.style.cssProperties, userAgentPropertyNames, true);
        continue;
      }
      const cssText = ruleEntry.rule.style.cssText?.trim();
      if (!cssText) {
        continue;
      }
      const filtered = filterInheritableDeclarations(cssText);
      if (!filtered || seenCssTexts.has(filtered)) {
        continue;
      }
      seenCssTexts.add(filtered);
      collectVarReferences(filtered, referencedVars);
      collectPropertyNames(ruleEntry.rule.style.cssProperties, authorPropertyNames, true);
      const selectors = ruleEntry.rule.selectorList.selectors.map((s) => s.text).join(", ");
      inheritedLines.push(`${selectors} { ${filtered} }`);
    }
  }
  if (inheritedLines.length > 0) {
    lines.push("");
    lines.push("/* Inherited */");
    lines.push(...inheritedLines);
  }
  for (const prop of alwaysResolvedProperties) {
    authorPropertyNames.add(prop);
  }
  return { rulesText: lines.join("\n"), referencedVars, authorPropertyNames, userAgentPropertyNames };
}
const boxShorthands = [
  // margin: <margin-top> <margin-right> <margin-bottom> <margin-left>
  { shorthand: "margin", sides: ["margin-top", "margin-right", "margin-bottom", "margin-left"] },
  // padding: <padding-top> <padding-right> <padding-bottom> <padding-left>
  { shorthand: "padding", sides: ["padding-top", "padding-right", "padding-bottom", "padding-left"] },
  // border-radius: <TL> <TR> <BR> <BL>   (clockwise from top-left)
  { shorthand: "border-radius", sides: ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"] }
];
const borderSideGroups = [
  // border-width: initial medium per MDN (but computed is always an absolute length)
  { shorthand: "border-width", sides: ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"] },
  // border-style: initial none per MDN
  { shorthand: "border-style", sides: ["border-top-style", "border-right-style", "border-bottom-style", "border-left-style"] },
  // border-color: initial currentcolor per MDN
  { shorthand: "border-color", sides: ["border-top-color", "border-right-color", "border-bottom-color", "border-left-color"] }
];
const dropWhenAllDefault = [
  // border-image  (CSS Backgrounds & Borders 3 section 6.8)
  {
    longhands: {
      "border-image-source": "none",
      "border-image-slice": "100%",
      "border-image-width": "1",
      "border-image-outset": "0",
      "border-image-repeat": "stretch"
    }
  },
  // animation-range  (CSS Scroll-driven Animations section 5.2)  initial: normal
  {
    longhands: {
      "animation-range-start": "normal",
      "animation-range-end": "normal"
    }
  }
];
const backgroundCollapse = {
  colorLonghand: "background-color",
  otherLonghands: {
    // MDN background formal definition initial values:
    "background-image": "none",
    // initial: none
    "background-position-x": "0px",
    // initial: 0% (computed as 0px)
    "background-position-y": "0px",
    // initial: 0%
    "background-size": "auto",
    // initial: auto auto
    "background-repeat": "repeat",
    // initial: repeat
    "background-attachment": "scroll",
    // initial: scroll
    "background-origin": "padding-box",
    // initial: padding-box
    "background-clip": "border-box"
    // initial: border-box
  }
};
const simpleShorthands = [
  // text-decoration (CSS Text Decoration 4 section 3)
  // Constituents: text-decoration-line || text-decoration-style || text-decoration-color || text-decoration-thickness
  {
    shorthand: "text-decoration",
    longhands: [
      { name: "text-decoration-line", initial: "none" },
      { name: "text-decoration-style", initial: "solid" },
      { name: "text-decoration-color", initial: "currentcolor" },
      { name: "text-decoration-thickness", initial: "auto" }
    ]
  }
];
const whiteSpaceKeywords = [
  { collapse: "collapse", wrap: "wrap", keyword: "normal" },
  { collapse: "collapse", wrap: "nowrap", keyword: "nowrap" },
  { collapse: "preserve", wrap: "nowrap", keyword: "pre" },
  { collapse: "preserve", wrap: "wrap", keyword: "pre-wrap" },
  { collapse: "preserve-breaks", wrap: "wrap", keyword: "pre-line" },
  { collapse: "break-spaces", wrap: "wrap", keyword: "break-spaces" }
];
const listShorthands = [
  // transition (CSS Transitions 1 section 2.1)
  // Constituents: transition-property || transition-duration || transition-timing-function || transition-delay || transition-behavior
  {
    shorthand: "transition",
    longhands: [
      { name: "transition-property", initial: "all" },
      { name: "transition-duration", initial: "0s" },
      { name: "transition-timing-function", initial: "ease" },
      { name: "transition-delay", initial: "0s" },
      { name: "transition-behavior", initial: "normal" }
    ]
  },
  // animation (CSS Animations 1 section 3 + Scroll-driven Animations section 5)
  // Constituents: animation-name || animation-duration || animation-timing-function || animation-delay
  //             || animation-iteration-count || animation-direction || animation-fill-mode
  //             || animation-play-state || animation-timeline
  {
    shorthand: "animation",
    longhands: [
      { name: "animation-name", initial: "none" },
      { name: "animation-duration", initial: "0s" },
      { name: "animation-timing-function", initial: "ease" },
      { name: "animation-delay", initial: "0s" },
      { name: "animation-iteration-count", initial: "1" },
      { name: "animation-direction", initial: "normal" },
      { name: "animation-fill-mode", initial: "none" },
      { name: "animation-play-state", initial: "running" },
      { name: "animation-timeline", initial: "auto" }
    ]
  }
];
function collapseBoxValues(entries, sides) {
  const [topKey, rightKey, bottomKey, leftKey] = sides;
  const top = entries.get(topKey);
  const right = entries.get(rightKey);
  const bottom = entries.get(bottomKey);
  const left = entries.get(leftKey);
  if (top === void 0 || right === void 0 || bottom === void 0 || left === void 0) {
    return void 0;
  }
  entries.delete(topKey);
  entries.delete(rightKey);
  entries.delete(bottomKey);
  entries.delete(leftKey);
  if (top === right && right === bottom && bottom === left) {
    return top;
  }
  if (top === bottom && right === left) {
    return `${top} ${right}`;
  }
  if (right === left) {
    return `${top} ${right} ${bottom}`;
  }
  return `${top} ${right} ${bottom} ${left}`;
}
function splitCSSList(value) {
  const items = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    } else if (ch === "," && depth === 0) {
      items.push(value.substring(start, i).trim());
      start = i + 1;
    }
  }
  items.push(value.substring(start).trim());
  return items;
}
function collapseListShorthand(entries, output, shorthand, longhands) {
  const values = longhands.map(({ name }) => entries.get(name));
  if (!values.every((v) => v !== void 0)) {
    return;
  }
  const lists = values.map((v) => splitCSSList(v));
  const itemCount = lists[0].length;
  if (!lists.every((l) => l.length === itemCount)) {
    return;
  }
  for (const { name } of longhands) {
    entries.delete(name);
  }
  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const parts = [];
    for (let j = 0; j < longhands.length; j++) {
      const val = lists[j][i];
      if (val !== longhands[j].initial) {
        parts.push(val);
      }
    }
    items.push(parts.length > 0 ? parts.join(" ") : longhands[0].initial);
  }
  output.push(`${shorthand}: ${items.join(", ")};`);
}
function collapseToShorthands(entries) {
  const shorthandLines = [];
  for (const { shorthand, sides } of boxShorthands) {
    const collapsed = collapseBoxValues(entries, sides);
    if (collapsed !== void 0) {
      shorthandLines.push(`${shorthand}: ${collapsed};`);
    }
  }
  const borderVals = borderSideGroups.map((g) => g.sides.map((s) => entries.get(s)));
  const hasAllBorderProps = borderVals.every((group) => group.every((v) => v !== void 0));
  if (hasAllBorderProps) {
    const allUniform = borderVals.every((group) => group.every((v) => v === group[0]));
    if (allUniform) {
      for (const group of borderSideGroups) {
        for (const side of group.sides) {
          entries.delete(side);
        }
      }
      shorthandLines.push(`border: ${borderVals[0][0]} ${borderVals[1][0]} ${borderVals[2][0]};`);
    } else {
      for (const group of borderSideGroups) {
        const collapsed = collapseBoxValues(entries, group.sides);
        if (collapsed !== void 0) {
          shorthandLines.push(`${group.shorthand}: ${collapsed};`);
        }
      }
    }
  }
  for (const { longhands } of dropWhenAllDefault) {
    const allDefault = Object.entries(longhands).every(([k, v]) => entries.get(k) === v);
    if (allDefault && Object.keys(longhands).some((k) => entries.has(k))) {
      for (const key of Object.keys(longhands)) {
        entries.delete(key);
      }
    }
  }
  {
    const { colorLonghand, otherLonghands } = backgroundCollapse;
    const bgColor = entries.get(colorLonghand);
    const allOthersDefault = Object.entries(otherLonghands).every(([k, v]) => entries.get(k) === v);
    if (allOthersDefault && bgColor !== void 0) {
      entries.delete(colorLonghand);
      for (const key of Object.keys(otherLonghands)) {
        entries.delete(key);
      }
      shorthandLines.push(`background: ${bgColor};`);
    }
  }
  for (const { shorthand, longhands } of simpleShorthands) {
    const first = entries.get(longhands[0].name);
    if (first === void 0) {
      continue;
    }
    const values = longhands.map(({ name }) => entries.get(name));
    for (const { name } of longhands) {
      entries.delete(name);
    }
    const parts = [];
    for (let i = 0; i < longhands.length; i++) {
      const val = values[i] ?? longhands[i].initial;
      if (val !== longhands[i].initial) {
        parts.push(val);
      }
    }
    shorthandLines.push(`${shorthand}: ${parts.length > 0 ? parts.join(" ") : longhands[0].initial};`);
  }
  {
    const wsCollapse = entries.get("white-space-collapse");
    const textWrap = entries.get("text-wrap-mode");
    if (wsCollapse !== void 0 && textWrap !== void 0) {
      entries.delete("white-space-collapse");
      entries.delete("text-wrap-mode");
      const match = whiteSpaceKeywords.find((k) => k.collapse === wsCollapse && k.wrap === textWrap);
      shorthandLines.push(`white-space: ${match ? match.keyword : `${wsCollapse} ${textWrap}`};`);
    }
  }
  for (const { shorthand, longhands } of listShorthands) {
    collapseListShorthand(entries, shorthandLines, shorthand, longhands);
  }
  const remainingLines = [];
  for (const [name, value] of Array.from(entries.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    remainingLines.push(`${name}: ${value};`);
  }
  return [...shorthandLines, ...remainingLines];
}
export {
  collapseToShorthands,
  filterInheritableDeclarations,
  formatMatchedStyles,
  keyComputedProperties
};
