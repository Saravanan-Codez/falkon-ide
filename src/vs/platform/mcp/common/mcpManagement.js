import { createDecorator } from "../../instantiation/common/instantiation.js";
var RegistryType = /* @__PURE__ */ ((RegistryType2) => {
  RegistryType2["NODE"] = "npm";
  RegistryType2["PYTHON"] = "pypi";
  RegistryType2["DOCKER"] = "oci";
  RegistryType2["NUGET"] = "nuget";
  RegistryType2["MCPB"] = "mcpb";
  RegistryType2["REMOTE"] = "remote";
  return RegistryType2;
})(RegistryType || {});
var TransportType = /* @__PURE__ */ ((TransportType2) => {
  TransportType2["STDIO"] = "stdio";
  TransportType2["STREAMABLE_HTTP"] = "streamable-http";
  TransportType2["SSE"] = "sse";
  return TransportType2;
})(TransportType || {});
var GalleryMcpServerStatus = /* @__PURE__ */ ((GalleryMcpServerStatus2) => {
  GalleryMcpServerStatus2["Active"] = "active";
  GalleryMcpServerStatus2["Deprecated"] = "deprecated";
  return GalleryMcpServerStatus2;
})(GalleryMcpServerStatus || {});
var McpGalleryResolveStatus = /* @__PURE__ */ ((McpGalleryResolveStatus2) => {
  McpGalleryResolveStatus2[McpGalleryResolveStatus2["Found"] = 0] = "Found";
  McpGalleryResolveStatus2[McpGalleryResolveStatus2["NotFound"] = 1] = "NotFound";
  McpGalleryResolveStatus2[McpGalleryResolveStatus2["Failed"] = 2] = "Failed";
  return McpGalleryResolveStatus2;
})(McpGalleryResolveStatus || {});
const IMcpGalleryService = createDecorator("IMcpGalleryService");
const IMcpManagementService = createDecorator("IMcpManagementService");
const IAllowedMcpServersService = createDecorator("IAllowedMcpServersService");
const mcpAccessConfig = "chat.mcp.access";
const mcpAllowedServersConfig = "chat.mcp.allowedServers";
const mcpDeniedServersConfig = "chat.mcp.deniedServers";
const mcpGalleryServiceUrlConfig = "chat.mcp.gallery.serviceUrl";
const mcpGalleryServiceEnablementConfig = "chat.mcp.gallery.enabled";
const mcpAutoStartConfig = "chat.mcp.autostart";
const mcpAppsEnabledConfig = "chat.mcp.apps.enabled";
var McpAutoStartValue = /* @__PURE__ */ ((McpAutoStartValue2) => {
  McpAutoStartValue2["Never"] = "never";
  McpAutoStartValue2["OnlyNew"] = "onlyNew";
  McpAutoStartValue2["NewAndOutdated"] = "newAndOutdated";
  return McpAutoStartValue2;
})(McpAutoStartValue || {});
var McpAccessValue = /* @__PURE__ */ ((McpAccessValue2) => {
  McpAccessValue2["None"] = "none";
  McpAccessValue2["Registry"] = "registry";
  McpAccessValue2["All"] = "all";
  return McpAccessValue2;
})(McpAccessValue || {});
export {
  GalleryMcpServerStatus,
  IAllowedMcpServersService,
  IMcpGalleryService,
  IMcpManagementService,
  McpAccessValue,
  McpAutoStartValue,
  McpGalleryResolveStatus,
  RegistryType,
  TransportType,
  mcpAccessConfig,
  mcpAllowedServersConfig,
  mcpAppsEnabledConfig,
  mcpAutoStartConfig,
  mcpDeniedServersConfig,
  mcpGalleryServiceEnablementConfig,
  mcpGalleryServiceUrlConfig
};
