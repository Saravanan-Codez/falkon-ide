import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IAiSettingsSearchService = createDecorator("IAiSettingsSearchService");
var AiSettingsSearchResultKind = /* @__PURE__ */ ((AiSettingsSearchResultKind2) => {
  AiSettingsSearchResultKind2[AiSettingsSearchResultKind2["EMBEDDED"] = 1] = "EMBEDDED";
  AiSettingsSearchResultKind2[AiSettingsSearchResultKind2["LLM_RANKED"] = 2] = "LLM_RANKED";
  AiSettingsSearchResultKind2[AiSettingsSearchResultKind2["CANCELED"] = 3] = "CANCELED";
  return AiSettingsSearchResultKind2;
})(AiSettingsSearchResultKind || {});
export {
  AiSettingsSearchResultKind,
  IAiSettingsSearchService
};
