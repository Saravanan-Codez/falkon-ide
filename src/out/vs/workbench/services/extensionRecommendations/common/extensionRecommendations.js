import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
var ExtensionRecommendationReason = /* @__PURE__ */ ((ExtensionRecommendationReason2) => {
  ExtensionRecommendationReason2[ExtensionRecommendationReason2["Workspace"] = 0] = "Workspace";
  ExtensionRecommendationReason2[ExtensionRecommendationReason2["File"] = 1] = "File";
  ExtensionRecommendationReason2[ExtensionRecommendationReason2["Executable"] = 2] = "Executable";
  ExtensionRecommendationReason2[ExtensionRecommendationReason2["WorkspaceConfig"] = 3] = "WorkspaceConfig";
  ExtensionRecommendationReason2[ExtensionRecommendationReason2["DynamicWorkspace"] = 4] = "DynamicWorkspace";
  ExtensionRecommendationReason2[ExtensionRecommendationReason2["Experimental"] = 5] = "Experimental";
  ExtensionRecommendationReason2[ExtensionRecommendationReason2["Application"] = 6] = "Application";
  return ExtensionRecommendationReason2;
})(ExtensionRecommendationReason || {});
const IExtensionRecommendationsService = createDecorator("extensionRecommendationsService");
const IExtensionIgnoredRecommendationsService = createDecorator("IExtensionIgnoredRecommendationsService");
export {
  ExtensionRecommendationReason,
  IExtensionIgnoredRecommendationsService,
  IExtensionRecommendationsService
};
