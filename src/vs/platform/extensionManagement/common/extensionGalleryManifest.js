import { createDecorator } from "../../instantiation/common/instantiation.js";
var ExtensionGalleryResourceType = /* @__PURE__ */ ((ExtensionGalleryResourceType2) => {
  ExtensionGalleryResourceType2["ExtensionQueryService"] = "ExtensionQueryService";
  ExtensionGalleryResourceType2["ExtensionLatestVersionUri"] = "ExtensionLatestVersionUriTemplate";
  ExtensionGalleryResourceType2["ExtensionStatisticsUri"] = "ExtensionStatisticsUriTemplate";
  ExtensionGalleryResourceType2["PublisherViewUri"] = "PublisherViewUriTemplate";
  ExtensionGalleryResourceType2["ExtensionDetailsViewUri"] = "ExtensionDetailsViewUriTemplate";
  ExtensionGalleryResourceType2["ExtensionRatingViewUri"] = "ExtensionRatingViewUriTemplate";
  ExtensionGalleryResourceType2["ExtensionResourceUri"] = "ExtensionResourceUriTemplate";
  ExtensionGalleryResourceType2["ContactSupportUri"] = "ContactSupportUri";
  return ExtensionGalleryResourceType2;
})(ExtensionGalleryResourceType || {});
var Flag = /* @__PURE__ */ ((Flag2) => {
  Flag2["None"] = "None";
  Flag2["IncludeVersions"] = "IncludeVersions";
  Flag2["IncludeFiles"] = "IncludeFiles";
  Flag2["IncludeCategoryAndTags"] = "IncludeCategoryAndTags";
  Flag2["IncludeSharedAccounts"] = "IncludeSharedAccounts";
  Flag2["IncludeVersionProperties"] = "IncludeVersionProperties";
  Flag2["ExcludeNonValidated"] = "ExcludeNonValidated";
  Flag2["IncludeInstallationTargets"] = "IncludeInstallationTargets";
  Flag2["IncludeAssetUri"] = "IncludeAssetUri";
  Flag2["IncludeStatistics"] = "IncludeStatistics";
  Flag2["IncludeLatestVersionOnly"] = "IncludeLatestVersionOnly";
  Flag2["Unpublished"] = "Unpublished";
  Flag2["IncludeNameConflictInfo"] = "IncludeNameConflictInfo";
  Flag2["IncludeLatestPrereleaseAndStableVersionOnly"] = "IncludeLatestPrereleaseAndStableVersionOnly";
  return Flag2;
})(Flag || {});
var ExtensionGalleryManifestStatus = /* @__PURE__ */ ((ExtensionGalleryManifestStatus2) => {
  ExtensionGalleryManifestStatus2["Available"] = "available";
  ExtensionGalleryManifestStatus2["RequiresSignIn"] = "requiresSignIn";
  ExtensionGalleryManifestStatus2["AccessDenied"] = "accessDenied";
  ExtensionGalleryManifestStatus2["Unavailable"] = "unavailable";
  return ExtensionGalleryManifestStatus2;
})(ExtensionGalleryManifestStatus || {});
const IExtensionGalleryManifestService = createDecorator("IExtensionGalleryManifestService");
function getExtensionGalleryManifestResourceUri(manifest, type) {
  const [name, version] = type.split("/");
  for (const resource of manifest.resources) {
    const [r, v] = resource.type.split("/");
    if (r !== name) {
      continue;
    }
    if (!version || v === version) {
      return resource.id;
    }
    break;
  }
  return void 0;
}
const ExtensionGalleryServiceUrlConfigKey = "extensions.gallery.serviceUrl";
export {
  ExtensionGalleryManifestStatus,
  ExtensionGalleryResourceType,
  ExtensionGalleryServiceUrlConfigKey,
  Flag,
  IExtensionGalleryManifestService,
  getExtensionGalleryManifestResourceUri
};
