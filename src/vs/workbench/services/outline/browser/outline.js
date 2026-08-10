import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IOutlineService = createDecorator("IOutlineService");
var OutlineTarget = /* @__PURE__ */ ((OutlineTarget2) => {
  OutlineTarget2[OutlineTarget2["OutlinePane"] = 1] = "OutlinePane";
  OutlineTarget2[OutlineTarget2["Breadcrumbs"] = 2] = "Breadcrumbs";
  OutlineTarget2[OutlineTarget2["QuickPick"] = 4] = "QuickPick";
  return OutlineTarget2;
})(OutlineTarget || {});
var OutlineConfigKeys = /* @__PURE__ */ ((OutlineConfigKeys2) => {
  OutlineConfigKeys2["icons"] = "outline.icons";
  OutlineConfigKeys2["collapseItems"] = "outline.collapseItems";
  OutlineConfigKeys2["problemsEnabled"] = "outline.problems.enabled";
  OutlineConfigKeys2["problemsColors"] = "outline.problems.colors";
  OutlineConfigKeys2["problemsBadges"] = "outline.problems.badges";
  return OutlineConfigKeys2;
})(OutlineConfigKeys || {});
var OutlineConfigCollapseItemsValues = /* @__PURE__ */ ((OutlineConfigCollapseItemsValues2) => {
  OutlineConfigCollapseItemsValues2["Collapsed"] = "alwaysCollapse";
  OutlineConfigCollapseItemsValues2["Expanded"] = "alwaysExpand";
  return OutlineConfigCollapseItemsValues2;
})(OutlineConfigCollapseItemsValues || {});
export {
  IOutlineService,
  OutlineConfigCollapseItemsValues,
  OutlineConfigKeys,
  OutlineTarget
};
