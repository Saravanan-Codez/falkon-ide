import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
var OutlineSortOrder = /* @__PURE__ */ ((OutlineSortOrder2) => {
  OutlineSortOrder2[OutlineSortOrder2["ByPosition"] = 0] = "ByPosition";
  OutlineSortOrder2[OutlineSortOrder2["ByName"] = 1] = "ByName";
  OutlineSortOrder2[OutlineSortOrder2["ByKind"] = 2] = "ByKind";
  return OutlineSortOrder2;
})(OutlineSortOrder || {});
var IOutlinePane;
((IOutlinePane2) => {
  IOutlinePane2.Id = "outline";
})(IOutlinePane || (IOutlinePane = {}));
const ctxFollowsCursor = new RawContextKey("outlineFollowsCursor", false);
const ctxFilterOnType = new RawContextKey("outlineFiltersOnType", false);
const ctxSortMode = new RawContextKey("outlineSortMode", 0 /* ByPosition */);
const ctxAllCollapsed = new RawContextKey("outlineAllCollapsed", false);
const ctxFocused = new RawContextKey("outlineFocused", true);
export {
  IOutlinePane,
  OutlineSortOrder,
  ctxAllCollapsed,
  ctxFilterOnType,
  ctxFocused,
  ctxFollowsCursor,
  ctxSortMode
};
