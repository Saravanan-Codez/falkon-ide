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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { IRequestService, isSuccess } from "../../request/common/request.js";
import { McpGalleryResourceType, McpGalleryManifestStatus } from "./mcpGalleryManifest.js";
const SUPPORTED_VERSIONS = [
  "v0.1",
  "v0"
];
let McpGalleryManifestService = class extends Disposable {
  constructor(productService, requestService, logService) {
    super();
    this.productService = productService;
    this.requestService = requestService;
    this.logService = logService;
    this.onDidChangeMcpGalleryManifest = Event.None;
    this.onDidChangeMcpGalleryManifestStatus = Event.None;
    this.versionByUrl = /* @__PURE__ */ new Map();
  }
  get mcpGalleryManifestStatus() {
    return !!this.productService.mcpGallery?.serviceUrl ? McpGalleryManifestStatus.Available : McpGalleryManifestStatus.Unavailable;
  }
  async getMcpGalleryManifest() {
    if (!this.productService.mcpGallery) {
      return null;
    }
    return this.createMcpGalleryManifest(this.productService.mcpGallery.serviceUrl, SUPPORTED_VERSIONS[0]);
  }
  async createMcpGalleryManifest(url, version) {
    url = url.endsWith("/") ? url.slice(0, -1) : url;
    if (!version) {
      let versionPromise = this.versionByUrl.get(url);
      if (!versionPromise) {
        this.versionByUrl.set(url, versionPromise = this.getVersion(url));
      }
      version = await versionPromise;
    }
    const isProductGalleryUrl = this.productService.mcpGallery?.serviceUrl === url;
    const serversUrl = `${url}/${version}/servers`;
    const resources = [
      {
        id: serversUrl,
        type: McpGalleryResourceType.McpServersQueryService
      },
      {
        id: `${serversUrl}/{name}/versions/{version}`,
        type: McpGalleryResourceType.McpServerVersionUri
      },
      {
        id: `${serversUrl}/{name}/versions/latest`,
        type: McpGalleryResourceType.McpServerLatestVersionUri
      }
    ];
    if (isProductGalleryUrl) {
      resources.push({
        id: `${serversUrl}/by-name/{name}`,
        type: McpGalleryResourceType.McpServerNamedResourceUri
      });
      resources.push({
        id: this.productService.mcpGallery.itemWebUrl,
        type: McpGalleryResourceType.McpServerWebUri
      });
      resources.push({
        id: this.productService.mcpGallery.publisherUrl,
        type: McpGalleryResourceType.PublisherUriTemplate
      });
      resources.push({
        id: this.productService.mcpGallery.supportUrl,
        type: McpGalleryResourceType.ContactSupportUri
      });
      resources.push({
        id: this.productService.mcpGallery.supportUrl,
        type: McpGalleryResourceType.ContactSupportUri
      });
      resources.push({
        id: this.productService.mcpGallery.privacyPolicyUrl,
        type: McpGalleryResourceType.PrivacyPolicyUri
      });
      resources.push({
        id: this.productService.mcpGallery.termsOfServiceUrl,
        type: McpGalleryResourceType.TermsOfServiceUri
      });
      resources.push({
        id: this.productService.mcpGallery.reportUrl,
        type: McpGalleryResourceType.ReportUri
      });
    }
    if (version === "v0") {
      resources.push({
        id: `${serversUrl}/{id}`,
        type: McpGalleryResourceType.McpServerIdUri
      });
    }
    return {
      version,
      url,
      resources
    };
  }
  async getVersion(url) {
    for (const version of SUPPORTED_VERSIONS) {
      if (await this.checkVersion(url, version)) {
        return version;
      }
    }
    return SUPPORTED_VERSIONS[0];
  }
  async checkVersion(url, version) {
    try {
      const context = await this.requestService.request({
        type: "GET",
        url: `${url}/${version}/servers?limit=1`,
        callSite: "mcpGalleryManifestService.checkVersion"
      }, CancellationToken.None);
      if (isSuccess(context)) {
        return true;
      }
      this.logService.info(`The service at ${url} does not support version ${version}. Service returned status ${context.res.statusCode}.`);
    } catch (error) {
      this.logService.error(error);
    }
    return false;
  }
};
McpGalleryManifestService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IRequestService),
  __decorateParam(2, ILogService)
], McpGalleryManifestService);
export {
  McpGalleryManifestService
};
