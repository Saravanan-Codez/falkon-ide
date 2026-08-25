import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
var GitRefType = /* @__PURE__ */ ((GitRefType2) => {
  GitRefType2[GitRefType2["Head"] = 0] = "Head";
  GitRefType2[GitRefType2["RemoteHead"] = 1] = "RemoteHead";
  GitRefType2[GitRefType2["Tag"] = 2] = "Tag";
  return GitRefType2;
})(GitRefType || {});
const IGitService = createDecorator("gitService");
export {
  GitRefType,
  IGitService
};
