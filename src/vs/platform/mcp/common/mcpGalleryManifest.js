import { createDecorator } from "../../instantiation/common/instantiation.js";
var McpGalleryResourceType = /* @__PURE__ */ ((McpGalleryResourceType2) => {
  McpGalleryResourceType2["McpServersQueryService"] = "McpServersQueryService";
  McpGalleryResourceType2["McpServerWebUri"] = "McpServerWebUriTemplate";
  McpGalleryResourceType2["McpServerVersionUri"] = "McpServerVersionUriTemplate";
  McpGalleryResourceType2["McpServerIdUri"] = "McpServerIdUriTemplate";
  McpGalleryResourceType2["McpServerLatestVersionUri"] = "McpServerLatestVersionUriTemplate";
  McpGalleryResourceType2["McpServerNamedResourceUri"] = "McpServerNamedResourceUriTemplate";
  McpGalleryResourceType2["PublisherUriTemplate"] = "PublisherUriTemplate";
  McpGalleryResourceType2["ContactSupportUri"] = "ContactSupportUri";
  McpGalleryResourceType2["PrivacyPolicyUri"] = "PrivacyPolicyUri";
  McpGalleryResourceType2["TermsOfServiceUri"] = "TermsOfServiceUri";
  McpGalleryResourceType2["ReportUri"] = "ReportUri";
  return McpGalleryResourceType2;
})(McpGalleryResourceType || {});
var McpGalleryManifestStatus = /* @__PURE__ */ ((McpGalleryManifestStatus2) => {
  McpGalleryManifestStatus2["Available"] = "available";
  McpGalleryManifestStatus2["Unavailable"] = "unavailable";
  return McpGalleryManifestStatus2;
})(McpGalleryManifestStatus || {});
const IMcpGalleryManifestService = createDecorator("IMcpGalleryManifestService");
function getMcpGalleryManifestResourceUri(manifest, type) {
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
export {
  IMcpGalleryManifestService,
  McpGalleryManifestStatus,
  McpGalleryResourceType,
  getMcpGalleryManifestResourceUri
};
