var HoverStyle = /* @__PURE__ */ ((HoverStyle2) => {
  HoverStyle2[HoverStyle2["Pointer"] = 1] = "Pointer";
  HoverStyle2[HoverStyle2["Mouse"] = 2] = "Mouse";
  return HoverStyle2;
})(HoverStyle || {});
function isManagedHoverTooltipMarkdownString(obj) {
  const candidate = obj;
  return typeof candidate === "object" && "markdown" in candidate && "markdownNotSupportedFallback" in candidate;
}
function isManagedHoverTooltipHTMLElement(obj) {
  const candidate = obj;
  return typeof candidate === "object" && "element" in candidate;
}
export {
  HoverStyle,
  isManagedHoverTooltipHTMLElement,
  isManagedHoverTooltipMarkdownString
};
