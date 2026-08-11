function isLocalizedString(thing) {
  return !!thing && typeof thing === "object" && typeof thing.original === "string" && typeof thing.value === "string";
}
function isICommandActionToggleInfo(thing) {
  return thing ? thing.condition !== void 0 : false;
}
export {
  isICommandActionToggleInfo,
  isLocalizedString
};
