var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { McpGalleryManifestStatus } from "../../../../platform/mcp/common/mcpGalleryManifest.js";
import { McpGalleryManifestService } from "../../../../platform/mcp/common/mcpGalleryManifestService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Emitter } from "../../../../base/common/event.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { mcpGalleryServiceUrlConfig } from "../../../../platform/mcp/common/mcpManagement.js";
let WorkbenchMcpGalleryManifestService = class extends McpGalleryManifestService {
  constructor(productService, remoteAgentService, requestService, logService, configurationService) {
    super(productService, requestService, logService);
    this.configurationService = configurationService;
    this.mcpGalleryManifest = null;
    this._onDidChangeMcpGalleryManifest = this._register(new Emitter());
    this.onDidChangeMcpGalleryManifest = this._onDidChangeMcpGalleryManifest.event;
    this.currentStatus = McpGalleryManifestStatus.Unavailable;
    this._onDidChangeMcpGalleryManifestStatus = this._register(new Emitter());
    this.onDidChangeMcpGalleryManifestStatus = this._onDidChangeMcpGalleryManifestStatus.event;
    const remoteConnection = remoteAgentService.getConnection();
    if (remoteConnection) {
      const channel = remoteConnection.getChannel("mcpGalleryManifest");
      this.getMcpGalleryManifest().then((manifest) => {
        channel.call("setMcpGalleryManifest", [manifest]);
        this._register(this.onDidChangeMcpGalleryManifest((manifest2) => channel.call("setMcpGalleryManifest", [manifest2])));
      });
    }
  }
  get mcpGalleryManifestStatus() {
    return this.currentStatus;
  }
  async getMcpGalleryManifest() {
    if (!this.initPromise) {
      this.initPromise = this.doGetMcpGalleryManifest();
    }
    await this.initPromise;
    return this.mcpGalleryManifest;
  }
  async doGetMcpGalleryManifest() {
    await this.getAndUpdateMcpGalleryManifest();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(mcpGalleryServiceUrlConfig) || e.affectsConfiguration("chat.mcp.gallery.version")) {
        this.getAndUpdateMcpGalleryManifest();
      }
    }));
  }
  async getAndUpdateMcpGalleryManifest() {
    const mcpGalleryConfig = this.configurationService.getValue("chat.mcp.gallery");
    if (mcpGalleryConfig?.serviceUrl) {
      this.update(await this.createMcpGalleryManifest(mcpGalleryConfig.serviceUrl, mcpGalleryConfig.version));
    } else {
      this.update(await super.getMcpGalleryManifest());
    }
  }
  update(manifest) {
    if (this.mcpGalleryManifest?.url === manifest?.url && this.mcpGalleryManifest?.version === manifest?.version) {
      return;
    }
    this.mcpGalleryManifest = manifest;
    if (this.mcpGalleryManifest) {
      this.logService.trace("MCP Registry configured:", this.mcpGalleryManifest.url);
    } else {
      this.logService.trace("No MCP Registry configured");
    }
    this.currentStatus = this.mcpGalleryManifest ? McpGalleryManifestStatus.Available : McpGalleryManifestStatus.Unavailable;
    this._onDidChangeMcpGalleryManifest.fire(this.mcpGalleryManifest);
    this._onDidChangeMcpGalleryManifestStatus.fire(this.currentStatus);
  }
};
WorkbenchMcpGalleryManifestService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IRequestService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IConfigurationService)
], WorkbenchMcpGalleryManifestService);
export {
  WorkbenchMcpGalleryManifestService
};
