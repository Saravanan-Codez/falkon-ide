import { createDecorator } from "../../instantiation/common/instantiation.js";
var FocusMode = /* @__PURE__ */ ((FocusMode2) => {
  FocusMode2[FocusMode2["Transfer"] = 0] = "Transfer";
  FocusMode2[FocusMode2["Notify"] = 1] = "Notify";
  FocusMode2[FocusMode2["Force"] = 2] = "Force";
  return FocusMode2;
})(FocusMode || {});
const INativeHostService = createDecorator("nativeHostService");
export {
  FocusMode,
  INativeHostService
};
