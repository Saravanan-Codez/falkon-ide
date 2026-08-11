import { createDecorator } from "../../instantiation/common/instantiation.js";
const ILabelService = createDecorator("labelService");
var Verbosity = /* @__PURE__ */ ((Verbosity2) => {
  Verbosity2[Verbosity2["SHORT"] = 0] = "SHORT";
  Verbosity2[Verbosity2["MEDIUM"] = 1] = "MEDIUM";
  Verbosity2[Verbosity2["LONG"] = 2] = "LONG";
  return Verbosity2;
})(Verbosity || {});
export {
  ILabelService,
  Verbosity
};
