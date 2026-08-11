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
import { distinct } from "../../../base/common/arrays.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import * as semver from "../../../base/common/semver/semver.js";
import { CancellationError, getErrorMessage, isCancellationError } from "../../../base/common/errors.js";
import { isWeb, platform } from "../../../base/common/platform.js";
import { arch } from "../../../base/common/process.js";
import { isBoolean, isNumber, isString } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { isOfflineError } from "../../../base/parts/request/common/request.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { getTargetPlatform, InstallOperation, isNotWebExtensionInWebTargetPlatform, isTargetPlatformCompatible, SortOrder, toTargetPlatform, WEB_EXTENSION_TAG, ExtensionGalleryError, ExtensionGalleryErrorCode, IAllowedExtensionsService, EXTENSION_IDENTIFIER_REGEX, SortBy, FilterType, ExtensionRequestsTimeoutConfigKey } from "./extensionManagement.js";
import { adoptToGalleryExtensionId, areSameExtensions, getGalleryExtensionId, getGalleryExtensionTelemetryData } from "./extensionManagementUtil.js";
import { TargetPlatform } from "../../extensions/common/extensions.js";
import { isEngineValid } from "../../extensions/common/extensionValidator.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { asJson, asTextOrError, IRequestService, isClientError, isServerError, isSuccess } from "../../request/common/request.js";
import { resolveMarketplaceHeaders } from "../../externalServices/common/marketplace.js";
import { IStorageService } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { format2 } from "../../../base/common/strings.js";
import { ExtensionGalleryResourceType, Flag, getExtensionGalleryManifestResourceUri, IExtensionGalleryManifestService, ExtensionGalleryManifestStatus } from "./extensionGalleryManifest.js";
import { TelemetryTrustedValue } from "../../telemetry/common/telemetryUtils.js";
const CURRENT_TARGET_PLATFORM = isWeb ? TargetPlatform.WEB : getTargetPlatform(platform, arch);
const SEARCH_ACTIVITY_HEADER_NAME = "X-Market-Search-Activity-Id";
const ACTIVITY_HEADER_NAME = "Activityid";
const SERVER_HEADER_NAME = "Server";
const END_END_ID_HEADER_NAME = "X-Vss-E2eid";
const AssetType = {
  Icon: "Microsoft.VisualStudio.Services.Icons.Default",
  Details: "Microsoft.VisualStudio.Services.Content.Details",
  Changelog: "Microsoft.VisualStudio.Services.Content.Changelog",
  Manifest: "Microsoft.VisualStudio.Code.Manifest",
  VSIX: "Microsoft.VisualStudio.Services.VSIXPackage",
  License: "Microsoft.VisualStudio.Services.Content.License",
  Repository: "Microsoft.VisualStudio.Services.Links.Source",
  Signature: "Microsoft.VisualStudio.Services.VsixSignature"
};
const PropertyType = {
  Dependency: "Microsoft.VisualStudio.Code.ExtensionDependencies",
  ExtensionPack: "Microsoft.VisualStudio.Code.ExtensionPack",
  Engine: "Microsoft.VisualStudio.Code.Engine",
  PreRelease: "Microsoft.VisualStudio.Code.PreRelease",
  EnabledApiProposals: "Microsoft.VisualStudio.Code.EnabledApiProposals",
  LocalizedLanguages: "Microsoft.VisualStudio.Code.LocalizedLanguages",
  WebExtension: "Microsoft.VisualStudio.Code.WebExtension",
  SponsorLink: "Microsoft.VisualStudio.Code.SponsorLink",
  SupportLink: "Microsoft.VisualStudio.Services.Links.Support",
  ExecutesCode: "Microsoft.VisualStudio.Code.ExecutesCode",
  Private: "PrivateMarketplace"
};
const DefaultPageSize = 10;
const DefaultQueryState = {
  pageNumber: 1,
  pageSize: DefaultPageSize,
  sortBy: SortBy.NoneOrRelevance,
  sortOrder: SortOrder.Default,
  flags: [],
  criteria: [],
  assetTypes: []
};
var VersionKind = /* @__PURE__ */ ((VersionKind2) => {
  VersionKind2[VersionKind2["Release"] = 0] = "Release";
  VersionKind2[VersionKind2["Prerelease"] = 1] = "Prerelease";
  VersionKind2[VersionKind2["Latest"] = 2] = "Latest";
  return VersionKind2;
})(VersionKind || {});
class Query {
  constructor(state = DefaultQueryState) {
    this.state = state;
  }
  get pageNumber() {
    return this.state.pageNumber;
  }
  get pageSize() {
    return this.state.pageSize;
  }
  get sortBy() {
    return this.state.sortBy;
  }
  get sortOrder() {
    return this.state.sortOrder;
  }
  get flags() {
    return this.state.flags;
  }
  get criteria() {
    return this.state.criteria;
  }
  get assetTypes() {
    return this.state.assetTypes;
  }
  get source() {
    return this.state.source;
  }
  get searchText() {
    const criterium = this.state.criteria.filter((criterium2) => criterium2.filterType === FilterType.SearchText)[0];
    return criterium && criterium.value ? criterium.value : "";
  }
  withPage(pageNumber, pageSize = this.state.pageSize) {
    return new Query({ ...this.state, pageNumber, pageSize });
  }
  withFilter(filterType, ...values) {
    const criteria = [
      ...this.state.criteria,
      ...values.length ? values.map((value) => ({ filterType, value })) : [{ filterType }]
    ];
    return new Query({ ...this.state, criteria });
  }
  withSortBy(sortBy) {
    return new Query({ ...this.state, sortBy });
  }
  withSortOrder(sortOrder) {
    return new Query({ ...this.state, sortOrder });
  }
  withFlags(...flags) {
    return new Query({ ...this.state, flags: distinct(flags) });
  }
  withAssetTypes(...assetTypes) {
    return new Query({ ...this.state, assetTypes });
  }
  withSource(source) {
    return new Query({ ...this.state, source });
  }
}
function getStatistic(statistics, name) {
  const result = (statistics || []).filter((s) => s.statisticName === name)[0];
  return result ? result.value : 0;
}
function getCoreTranslationAssets(version) {
  const coreTranslationAssetPrefix = "Microsoft.VisualStudio.Code.Translation.";
  const result = version.files.filter((f) => f.assetType.indexOf(coreTranslationAssetPrefix) === 0);
  return result.reduce((result2, file) => {
    const asset = getVersionAsset(version, file.assetType);
    if (asset) {
      result2.push([file.assetType.substring(coreTranslationAssetPrefix.length), asset]);
    }
    return result2;
  }, []);
}
function getRepositoryAsset(version) {
  if (version.properties) {
    const results = version.properties.filter((p) => p.key === AssetType.Repository);
    const gitRegExp = new RegExp("((git|ssh|http(s)?)|(git@[\\w.]+))(:(//)?)([\\w.@:/\\-~]+)(.git)(/)?");
    const uri = results.filter((r) => gitRegExp.test(r.value))[0];
    return uri ? { uri: uri.value, fallbackUri: uri.value } : null;
  }
  return getVersionAsset(version, AssetType.Repository);
}
function getDownloadAsset(version) {
  return {
    // always use fallbackAssetUri for download asset to hit the Marketplace API so that downloads are counted
    uri: `${version.fallbackAssetUri}/${AssetType.VSIX}?redirect=true${version.targetPlatform ? `&targetPlatform=${version.targetPlatform}` : ""}`,
    fallbackUri: `${version.fallbackAssetUri}/${AssetType.VSIX}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ""}`
  };
}
function getVersionAsset(version, type) {
  const result = version.files.filter((f) => f.assetType === type)[0];
  return result ? {
    uri: `${version.assetUri}/${type}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ""}`,
    fallbackUri: `${version.fallbackAssetUri}/${type}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ""}`
  } : null;
}
function getExtensions(version, property) {
  const values = version.properties ? version.properties.filter((p) => p.key === property) : [];
  const value = values.length > 0 && values[0].value;
  return value ? value.split(",").map((v) => adoptToGalleryExtensionId(v)) : [];
}
function getEngine(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.Engine) : [];
  return values.length > 0 && values[0].value || "";
}
function setEngine(version, engine) {
  version.properties = version.properties ?? [];
  version.properties.push({ key: PropertyType.Engine, value: engine });
}
function isPreReleaseVersion(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.PreRelease) : [];
  return values.length > 0 && values[0].value === "true";
}
function hasPreReleaseForExtension(id, productService) {
  return productService.extensionProperties?.[id.toLowerCase()]?.hasPrereleaseVersion;
}
function getExcludeVersionRangeForExtension(id, productService) {
  return productService.extensionProperties?.[id.toLowerCase()]?.excludeVersionRange;
}
function isPrivateExtension(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.Private) : [];
  return values.length > 0 && values[0].value === "true";
}
function executesCode(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.ExecutesCode) : [];
  return values.length > 0 ? values[0].value === "true" : void 0;
}
function getEnabledApiProposals(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.EnabledApiProposals) : [];
  const value = values.length > 0 && values[0].value || "";
  return value ? value.split(",") : [];
}
function getLocalizedLanguages(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.LocalizedLanguages) : [];
  const value = values.length > 0 && values[0].value || "";
  return value ? value.split(",") : [];
}
function getSponsorLink(version) {
  return version.properties?.find((p) => p.key === PropertyType.SponsorLink)?.value;
}
function getSupportLink(version) {
  return version.properties?.find((p) => p.key === PropertyType.SupportLink)?.value;
}
function getIsPreview(flags) {
  return flags.indexOf("preview") !== -1;
}
function getTargetPlatformForExtensionVersion(version) {
  return version.targetPlatform ? toTargetPlatform(version.targetPlatform) : TargetPlatform.UNDEFINED;
}
function getAllTargetPlatforms(rawGalleryExtension) {
  const allTargetPlatforms = distinct(rawGalleryExtension.versions.map(getTargetPlatformForExtensionVersion));
  const isWebExtension = !!rawGalleryExtension.tags?.includes(WEB_EXTENSION_TAG);
  const webTargetPlatformIndex = allTargetPlatforms.indexOf(TargetPlatform.WEB);
  if (isWebExtension) {
    if (webTargetPlatformIndex === -1) {
      allTargetPlatforms.push(TargetPlatform.WEB);
    }
  } else {
    if (webTargetPlatformIndex !== -1) {
      allTargetPlatforms.splice(webTargetPlatformIndex, 1);
    }
  }
  return allTargetPlatforms;
}
function sortExtensionVersions(versions, preferredTargetPlatform) {
  for (let index = 0; index < versions.length; index++) {
    const version = versions[index];
    if (version.version === versions[index - 1]?.version) {
      let insertionIndex = index;
      const versionTargetPlatform = getTargetPlatformForExtensionVersion(version);
      if (versionTargetPlatform === preferredTargetPlatform) {
        while (insertionIndex > 0 && versions[insertionIndex - 1].version === version.version) {
          insertionIndex--;
        }
      }
      if (insertionIndex !== index) {
        versions.splice(index, 1);
        versions.splice(insertionIndex, 0, version);
      }
    }
  }
  return versions;
}
function filterLatestExtensionVersionsForTargetPlatform(versions, targetPlatform, allTargetPlatforms) {
  const latestVersions = [];
  let preReleaseVersionIndex = -1;
  let releaseVersionIndex = -1;
  for (const version of versions) {
    const versionTargetPlatform = getTargetPlatformForExtensionVersion(version);
    const isCompatibleWithTargetPlatform = isTargetPlatformCompatible(versionTargetPlatform, allTargetPlatforms, targetPlatform);
    if (!isCompatibleWithTargetPlatform) {
      latestVersions.push(version);
      continue;
    }
    if (isPreReleaseVersion(version)) {
      if (preReleaseVersionIndex === -1) {
        preReleaseVersionIndex = latestVersions.length;
        latestVersions.push(version);
      } else if (versionTargetPlatform === targetPlatform && latestVersions[preReleaseVersionIndex].version === version.version) {
        latestVersions[preReleaseVersionIndex] = version;
      }
    } else {
      if (releaseVersionIndex === -1) {
        releaseVersionIndex = latestVersions.length;
        latestVersions.push(version);
      } else if (versionTargetPlatform === targetPlatform && latestVersions[releaseVersionIndex].version === version.version) {
        latestVersions[releaseVersionIndex] = version;
      }
    }
  }
  return latestVersions;
}
function setTelemetry(extension, index, querySource) {
  extension.telemetryData = { index, querySource, queryActivityId: extension.queryContext?.[SEARCH_ACTIVITY_HEADER_NAME] };
}
function toExtension(galleryExtension, version, allTargetPlatforms, extensionGalleryManifest, productService, queryContext) {
  const latestVersion = galleryExtension.versions[0];
  const assets = {
    manifest: getVersionAsset(version, AssetType.Manifest),
    readme: getVersionAsset(version, AssetType.Details),
    changelog: getVersionAsset(version, AssetType.Changelog),
    license: getVersionAsset(version, AssetType.License),
    repository: getRepositoryAsset(version),
    download: getDownloadAsset(version),
    icon: getVersionAsset(version, AssetType.Icon),
    signature: getVersionAsset(version, AssetType.Signature),
    coreTranslations: getCoreTranslationAssets(version)
  };
  const detailsViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, galleryExtension.linkType ?? ExtensionGalleryResourceType.ExtensionDetailsViewUri);
  const publisherViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, galleryExtension.publisher.linkType ?? ExtensionGalleryResourceType.PublisherViewUri);
  const ratingViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, galleryExtension.ratingLinkType ?? ExtensionGalleryResourceType.ExtensionRatingViewUri);
  const id = getGalleryExtensionId(galleryExtension.publisher.publisherName, galleryExtension.extensionName);
  return {
    type: "gallery",
    identifier: {
      id,
      uuid: galleryExtension.extensionId
    },
    name: galleryExtension.extensionName,
    version: version.version,
    displayName: galleryExtension.displayName,
    publisherId: galleryExtension.publisher.publisherId,
    publisher: galleryExtension.publisher.publisherName,
    publisherDisplayName: galleryExtension.publisher.displayName,
    publisherDomain: galleryExtension.publisher.domain ? { link: galleryExtension.publisher.domain, verified: !!galleryExtension.publisher.isDomainVerified } : void 0,
    publisherSponsorLink: getSponsorLink(latestVersion),
    description: galleryExtension.shortDescription ?? "",
    installCount: getStatistic(galleryExtension.statistics, "install"),
    rating: getStatistic(galleryExtension.statistics, "averagerating"),
    ratingCount: getStatistic(galleryExtension.statistics, "ratingcount"),
    categories: galleryExtension.categories || [],
    tags: galleryExtension.tags || [],
    releaseDate: Date.parse(galleryExtension.releaseDate),
    lastUpdated: Date.parse(galleryExtension.lastUpdated),
    allTargetPlatforms,
    assets,
    properties: {
      dependencies: getExtensions(version, PropertyType.Dependency),
      extensionPack: getExtensions(version, PropertyType.ExtensionPack),
      engine: getEngine(version),
      enabledApiProposals: getEnabledApiProposals(version),
      localizedLanguages: getLocalizedLanguages(version),
      targetPlatform: getTargetPlatformForExtensionVersion(version),
      isPreReleaseVersion: isPreReleaseVersion(version),
      executesCode: executesCode(version)
    },
    hasPreReleaseVersion: hasPreReleaseForExtension(id, productService) ?? isPreReleaseVersion(latestVersion),
    hasReleaseVersion: true,
    private: isPrivateExtension(latestVersion),
    preview: getIsPreview(galleryExtension.flags),
    isSigned: !!assets.signature,
    queryContext,
    supportLink: getSupportLink(latestVersion),
    detailsLink: detailsViewUri ? format2(detailsViewUri, { publisher: galleryExtension.publisher.publisherName, name: galleryExtension.extensionName }) : void 0,
    publisherLink: publisherViewUri ? format2(publisherViewUri, { publisher: galleryExtension.publisher.publisherName }) : void 0,
    ratingLink: ratingViewUri ? format2(ratingViewUri, { publisher: galleryExtension.publisher.publisherName, name: galleryExtension.extensionName }) : void 0
  };
}
let AbstractExtensionGalleryService = class {
  constructor(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
    this.requestService = requestService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.telemetryService = telemetryService;
    this.fileService = fileService;
    this.productService = productService;
    this.configurationService = configurationService;
    this.allowedExtensionsService = allowedExtensionsService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this.extensionsControlUrl = productService.extensionsGallery?.controlUrl;
    this.unpkgResourceApi = productService.extensionsGallery?.extensionUrlTemplate;
    this.commonHeadersPromise = resolveMarketplaceHeaders(
      productService.version,
      productService,
      this.environmentService,
      this.configurationService,
      this.fileService,
      storageService,
      this.telemetryService
    );
  }
  isEnabled() {
    return this.extensionGalleryManifestService.extensionGalleryManifestStatus === ExtensionGalleryManifestStatus.Available;
  }
  async getExtensions(extensionInfos, arg1, arg2) {
    const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!extensionGalleryManifest) {
      throw new Error("No extension gallery service configured.");
    }
    const options = CancellationToken.isCancellationToken(arg1) ? {} : arg1;
    const token = CancellationToken.isCancellationToken(arg1) ? arg1 : arg2;
    const resourceApi = this.getResourceApi(extensionGalleryManifest);
    const result = resourceApi ? await this.getExtensionsUsingResourceApi(extensionInfos, options, resourceApi, extensionGalleryManifest, token) : await this.getExtensionsUsingQueryApi(extensionInfos, options, extensionGalleryManifest, token);
    const uuids = result.map((r) => r.identifier.uuid);
    const extensionInfosByName = [];
    for (const e of extensionInfos) {
      if (e.uuid && !uuids.includes(e.uuid)) {
        extensionInfosByName.push({ ...e, uuid: void 0 });
      }
    }
    if (extensionInfosByName.length) {
      this.telemetryService.publicLog2("galleryService:additionalQueryByName", {
        count: extensionInfosByName.length
      });
      const extensions = await this.getExtensionsUsingQueryApi(extensionInfosByName, options, extensionGalleryManifest, token);
      result.push(...extensions);
    }
    return result;
  }
  getResourceApi(extensionGalleryManifest) {
    const latestVersionResource = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, ExtensionGalleryResourceType.ExtensionLatestVersionUri);
    if (latestVersionResource) {
      return {
        uri: latestVersionResource,
        fallback: this.unpkgResourceApi
      };
    }
    return void 0;
  }
  async getExtensionsUsingQueryApi(extensionInfos, options, extensionGalleryManifest, token) {
    const names = [], ids = [], includePreRelease = [], versions = [];
    let isQueryForReleaseVersionFromPreReleaseVersion = true;
    for (const extensionInfo of extensionInfos) {
      if (extensionInfo.uuid) {
        ids.push(extensionInfo.uuid);
      } else {
        names.push(extensionInfo.id);
      }
      if (extensionInfo.version) {
        versions.push({ id: extensionInfo.id, uuid: extensionInfo.uuid, version: extensionInfo.version });
      } else {
        includePreRelease.push({ id: extensionInfo.id, uuid: extensionInfo.uuid, includePreRelease: !!extensionInfo.preRelease });
      }
      isQueryForReleaseVersionFromPreReleaseVersion = isQueryForReleaseVersionFromPreReleaseVersion && (!!extensionInfo.hasPreRelease && !extensionInfo.preRelease);
    }
    if (!ids.length && !names.length) {
      return [];
    }
    let query = new Query().withPage(1, extensionInfos.length);
    if (ids.length) {
      query = query.withFilter(FilterType.ExtensionId, ...ids);
    }
    if (names.length) {
      query = query.withFilter(FilterType.ExtensionName, ...names);
    }
    if (options.queryAllVersions) {
      query = query.withFlags(...query.flags, Flag.IncludeVersions);
    }
    if (options.source) {
      query = query.withSource(options.source);
    }
    const { extensions } = await this.queryGalleryExtensions(
      query,
      {
        targetPlatform: options.targetPlatform ?? CURRENT_TARGET_PLATFORM,
        includePreRelease,
        versions,
        compatible: !!options.compatible,
        productVersion: options.productVersion ?? { version: this.productService.version, date: this.productService.date },
        isQueryForReleaseVersionFromPreReleaseVersion
      },
      extensionGalleryManifest,
      token
    );
    if (options.source) {
      extensions.forEach((e, index) => setTelemetry(e, index, options.source));
    }
    return extensions;
  }
  async getExtensionsUsingResourceApi(extensionInfos, options, resourceApi, extensionGalleryManifest, token) {
    const result = [];
    const toQuery = [];
    const toFetchLatest = [];
    for (const extensionInfo of extensionInfos) {
      if (!EXTENSION_IDENTIFIER_REGEX.test(extensionInfo.id)) {
        continue;
      }
      if (extensionInfo.version) {
        toQuery.push(extensionInfo);
      } else {
        toFetchLatest.push(extensionInfo);
      }
    }
    await Promise.all(toFetchLatest.map(async (extensionInfo) => {
      let galleryExtension;
      try {
        galleryExtension = await this.getLatestGalleryExtension(extensionInfo, options, resourceApi, extensionGalleryManifest, token);
        if (isString(galleryExtension)) {
          if (galleryExtension === "LATEST_IS_OUTDATED") {
            this.logService.debug(`Skipping query API fallback for extension ${extensionInfo.id} because the latest gallery version is older than the current version`);
          } else {
            this.telemetryService.publicLog2("galleryService:fallbacktoquery", {
              extension: extensionInfo.id,
              preRelease: !!extensionInfo.preRelease,
              compatible: !!options.compatible,
              errorCode: galleryExtension
            });
            toQuery.push(extensionInfo);
          }
        } else {
          result.push(galleryExtension);
        }
      } catch (error) {
        if (error instanceof ExtensionGalleryError) {
          switch (error.code) {
            case ExtensionGalleryErrorCode.Offline:
            case ExtensionGalleryErrorCode.Cancelled:
            case ExtensionGalleryErrorCode.Timeout:
              throw error;
          }
        }
        this.logService.error(`Error while getting the latest version for the extension ${extensionInfo.id}.`, getErrorMessage(error));
        this.telemetryService.publicLog2("galleryService:fallbacktoquery", {
          extension: extensionInfo.id,
          preRelease: !!extensionInfo.preRelease,
          compatible: !!options.compatible,
          errorCode: error instanceof ExtensionGalleryError ? error.code : "Unknown"
        });
        toQuery.push(extensionInfo);
      }
    }));
    if (toQuery.length) {
      const extensions = await this.getExtensionsUsingQueryApi(toQuery, options, extensionGalleryManifest, token);
      result.push(...extensions);
    }
    return result;
  }
  async getLatestGalleryExtension(extensionInfo, options, resourceApi, extensionGalleryManifest, token) {
    const rawGalleryExtension = await this.getLatestRawGalleryExtensionWithFallback(extensionInfo, resourceApi, token);
    if (!rawGalleryExtension) {
      return "NOT_FOUND";
    }
    const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
    const rawGalleryExtensionVersion = await this.getValidRawGalleryExtensionVersionFromLatestVersions(rawGalleryExtension, rawGalleryExtension.versions, extensionInfo, options, allTargetPlatforms);
    if (!rawGalleryExtensionVersion) {
      if (extensionInfo.currentVersion) {
        const latestVersion = rawGalleryExtension.versions.length > 0 ? rawGalleryExtension.versions[0].version : void 0;
        if (latestVersion && semver.lt(latestVersion, extensionInfo.currentVersion)) {
          return "LATEST_IS_OUTDATED";
        }
      }
      return "NOT_COMPATIBLE";
    }
    return toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, this.productService);
  }
  async getValidRawGalleryExtensionVersionFromLatestVersions(rawGalleryExtension, latestVersions, extensionInfo, options, allTargetPlatforms) {
    const targetPlatform = options.targetPlatform ?? CURRENT_TARGET_PLATFORM;
    const latestExtensionVersionsForTargetPlatform = filterLatestExtensionVersionsForTargetPlatform(latestVersions, targetPlatform, allTargetPlatforms);
    const result = await this.getValidRawGalleryExtensionVersion(
      rawGalleryExtension,
      latestExtensionVersionsForTargetPlatform,
      {
        targetPlatform,
        compatible: !!options.compatible,
        productVersion: options.productVersion ?? {
          version: this.productService.version,
          date: this.productService.date
        },
        version: extensionInfo.preRelease ? 1 /* Prerelease */ : 0 /* Release */
      },
      allTargetPlatforms
    );
    if (!extensionInfo.preRelease) {
      return result;
    }
    const prereleaseVersion = result;
    const releaseVersion = await this.getValidRawGalleryExtensionVersion(
      rawGalleryExtension,
      latestExtensionVersionsForTargetPlatform,
      {
        targetPlatform,
        compatible: !!options.compatible,
        productVersion: options.productVersion ?? {
          version: this.productService.version,
          date: this.productService.date
        },
        version: 0 /* Release */
      },
      allTargetPlatforms
    );
    if (prereleaseVersion && releaseVersion) {
      return semver.gt(releaseVersion.version, prereleaseVersion.version) ? releaseVersion : prereleaseVersion;
    }
    if (options.compatible) {
      if (releaseVersion) {
        const anyPrereleaseVersion = await this.getValidRawGalleryExtensionVersion(
          rawGalleryExtension,
          latestExtensionVersionsForTargetPlatform,
          {
            targetPlatform,
            compatible: false,
            productVersion: options.productVersion ?? {
              version: this.productService.version,
              date: this.productService.date
            },
            version: 1 /* Prerelease */
          },
          allTargetPlatforms
        );
        if (!anyPrereleaseVersion || semver.gt(releaseVersion.version, anyPrereleaseVersion.version)) {
          return releaseVersion;
        }
      }
      return prereleaseVersion;
    }
    return prereleaseVersion ?? releaseVersion ?? null;
  }
  async getCompatibleExtension(extension, includePreRelease, targetPlatform, productVersion = { version: this.productService.version, date: this.productService.date }) {
    if (isNotWebExtensionInWebTargetPlatform(extension.allTargetPlatforms, targetPlatform)) {
      return null;
    }
    if (await this.isExtensionCompatible(extension, includePreRelease, targetPlatform)) {
      return extension;
    }
    if (this.allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName }) !== true) {
      return null;
    }
    const result = await this.getExtensions([{
      ...extension.identifier,
      preRelease: includePreRelease,
      hasPreRelease: extension.hasPreReleaseVersion
    }], {
      compatible: true,
      productVersion,
      queryAllVersions: true,
      targetPlatform
    }, CancellationToken.None);
    return result[0] ?? null;
  }
  async isExtensionCompatible(extension, includePreRelease, targetPlatform, productVersion = { version: this.productService.version, date: this.productService.date }) {
    return this.isValidVersion(
      {
        id: extension.identifier.id,
        version: extension.version,
        isPreReleaseVersion: extension.properties.isPreReleaseVersion,
        targetPlatform: extension.properties.targetPlatform,
        manifestAsset: extension.assets.manifest,
        engine: extension.properties.engine,
        enabledApiProposals: extension.properties.enabledApiProposals
      },
      {
        targetPlatform,
        compatible: true,
        productVersion,
        version: includePreRelease ? 2 /* Latest */ : 0 /* Release */
      },
      extension.publisherDisplayName,
      extension.allTargetPlatforms
    );
  }
  async isValidVersion(extension, { targetPlatform, compatible, productVersion, version }, publisherDisplayName, allTargetPlatforms) {
    const hasPreRelease = hasPreReleaseForExtension(extension.id, this.productService);
    const excludeVersionRange = getExcludeVersionRangeForExtension(extension.id, this.productService);
    if (extension.isPreReleaseVersion && hasPreRelease === false) {
      return false;
    }
    if (excludeVersionRange && semver.satisfies(extension.version, excludeVersionRange)) {
      return false;
    }
    if (isString(version)) {
      if (extension.version !== version) {
        return false;
      }
    } else if (version === 0 /* Release */ || version === 1 /* Prerelease */) {
      if (extension.isPreReleaseVersion !== (version === 1 /* Prerelease */)) {
        return false;
      }
    }
    if (targetPlatform && !isTargetPlatformCompatible(extension.targetPlatform, allTargetPlatforms, targetPlatform)) {
      return false;
    }
    if (compatible) {
      if (this.allowedExtensionsService.isAllowed({ id: extension.id, publisherDisplayName, version: extension.version, prerelease: extension.isPreReleaseVersion, targetPlatform: extension.targetPlatform }) !== true) {
        return false;
      }
      if (!await this.isEngineValid(extension.id, extension.version, extension.engine, extension.manifestAsset, productVersion)) {
        return false;
      }
    }
    return true;
  }
  async isEngineValid(extensionId, version, engine, manifestAsset, productVersion) {
    if (!engine) {
      try {
        engine = await this.getEngine(extensionId, version, manifestAsset);
      } catch (error) {
        this.logService.error(`Error while getting the engine for the version ${version}.`, getErrorMessage(error));
        return false;
      }
    }
    if (!engine) {
      this.logService.error(`Missing engine for the extension ${extensionId} with version ${version}`);
      return false;
    }
    return isEngineValid(engine, productVersion.version, productVersion.date);
  }
  async getEngine(extensionId, version, manifestAsset) {
    if (!manifestAsset) {
      this.logService.error(`Missing engine and manifest asset for the extension ${extensionId} with version ${version}`);
      return void 0;
    }
    try {
      this.telemetryService.publicLog2("galleryService:engineFallback", { extension: extensionId, extensionVersion: version });
      const headers = { "Accept-Encoding": "gzip" };
      const context = await this.getAsset(extensionId, manifestAsset, AssetType.Manifest, version, "extensionGalleryService.engineVersion", { headers });
      const manifest = await asJson(context);
      if (!manifest) {
        this.logService.error(`Manifest was not found for the extension ${extensionId} with version ${version}`);
        return void 0;
      }
      return manifest.engines.vscode;
    } catch (error) {
      this.logService.error(`Error while getting the engine for the version ${version}.`, getErrorMessage(error));
      return void 0;
    }
  }
  async query(options, token) {
    const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!extensionGalleryManifest) {
      throw new Error("No extension gallery service configured.");
    }
    let text = options.text || "";
    const pageSize = options.pageSize ?? 50;
    let query = new Query().withPage(1, pageSize);
    if (text) {
      text = text.replace(/\bcategory:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedCategory, category) => {
        query = query.withFilter(FilterType.Category, category || quotedCategory);
        return "";
      });
      text = text.replace(/\btag:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedTag, tag) => {
        query = query.withFilter(FilterType.Tag, tag || quotedTag);
        return "";
      });
      text = text.replace(/\bfeatured(\s+|\b|$)/g, () => {
        query = query.withFilter(FilterType.Featured);
        return "";
      });
      text = text.trim();
      if (text) {
        text = text.length < 200 ? text : text.substring(0, 200);
        query = query.withFilter(FilterType.SearchText, text);
      }
      if (extensionGalleryManifest.capabilities.extensionQuery.sorting?.some((c) => c.name === SortBy.NoneOrRelevance)) {
        query = query.withSortBy(SortBy.NoneOrRelevance);
      }
    } else {
      if (extensionGalleryManifest.capabilities.extensionQuery.sorting?.some((c) => c.name === SortBy.InstallCount)) {
        query = query.withSortBy(SortBy.InstallCount);
      }
    }
    if (options.sortBy && extensionGalleryManifest.capabilities.extensionQuery.sorting?.some((c) => c.name === options.sortBy)) {
      query = query.withSortBy(options.sortBy);
    }
    if (typeof options.sortOrder === "number") {
      query = query.withSortOrder(options.sortOrder);
    }
    if (options.source) {
      query = query.withSource(options.source);
    }
    const runQuery = async (query2, token2) => {
      const { extensions: extensions2, total: total2 } = await this.queryGalleryExtensions(query2, { targetPlatform: CURRENT_TARGET_PLATFORM, compatible: false, includePreRelease: !!options.includePreRelease, productVersion: options.productVersion ?? { version: this.productService.version, date: this.productService.date } }, extensionGalleryManifest, token2);
      const result = [];
      let defaultChatAgentExtension;
      for (let index = 0; index < extensions2.length; index++) {
        const extension = extensions2[index];
        setTelemetry(extension, (query2.pageNumber - 1) * query2.pageSize + index, options.source);
        if (areSameExtensions(extension.identifier, { id: this.productService.defaultChatAgent.extensionId })) {
          defaultChatAgentExtension = extension;
        } else {
          result.push(extension);
        }
      }
      if (defaultChatAgentExtension) {
        result.push(defaultChatAgentExtension);
      }
      return { extensions: result, total: total2 };
    };
    const { extensions, total } = await runQuery(query, token);
    const getPage = async (pageIndex, ct) => {
      if (ct.isCancellationRequested) {
        throw new CancellationError();
      }
      const { extensions: extensions2 } = await runQuery(query.withPage(pageIndex + 1), ct);
      return extensions2;
    };
    return { firstPage: extensions, total, pageSize: query.pageSize, getPage };
  }
  async queryGalleryExtensions(query, criteria, extensionGalleryManifest, token) {
    const flags = query.flags;
    if (query.flags.includes(Flag.IncludeLatestVersionOnly) && query.flags.includes(Flag.IncludeVersions)) {
      query = query.withFlags(...query.flags.filter((flag) => flag !== Flag.IncludeVersions));
    }
    if (!query.flags.includes(Flag.IncludeLatestVersionOnly) && !query.flags.includes(Flag.IncludeVersions)) {
      query = query.withFlags(...query.flags, Flag.IncludeLatestVersionOnly);
    }
    if (criteria.versions?.length || criteria.isQueryForReleaseVersionFromPreReleaseVersion) {
      query = query.withFlags(...query.flags.filter((flag) => flag !== Flag.IncludeLatestVersionOnly), Flag.IncludeVersions);
    }
    query = query.withFlags(...query.flags, Flag.IncludeAssetUri, Flag.IncludeCategoryAndTags, Flag.IncludeFiles, Flag.IncludeStatistics, Flag.IncludeVersionProperties);
    const { galleryExtensions: rawGalleryExtensions, total, context } = await this.queryRawGalleryExtensions(query, extensionGalleryManifest, token);
    const hasAllVersions = !query.flags.includes(Flag.IncludeLatestVersionOnly);
    if (hasAllVersions) {
      const extensions = [];
      for (const rawGalleryExtension of rawGalleryExtensions) {
        const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
        const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
        const includePreRelease = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find((extensionIdentifierWithPreRelease) => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease;
        const rawGalleryExtensionVersion = await this.getValidRawGalleryExtensionVersion(
          rawGalleryExtension,
          rawGalleryExtension.versions,
          {
            compatible: criteria.compatible,
            targetPlatform: criteria.targetPlatform,
            productVersion: criteria.productVersion,
            version: criteria.versions?.find((extensionIdentifierWithVersion) => areSameExtensions(extensionIdentifierWithVersion, extensionIdentifier))?.version ?? (includePreRelease ? 2 /* Latest */ : 0 /* Release */)
          },
          allTargetPlatforms
        );
        if (rawGalleryExtensionVersion) {
          extensions.push(toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, this.productService, context));
        }
      }
      return { extensions, total };
    }
    const result = [];
    const needAllVersions = /* @__PURE__ */ new Map();
    for (let index = 0; index < rawGalleryExtensions.length; index++) {
      const rawGalleryExtension = rawGalleryExtensions[index];
      const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
      const includePreRelease = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find((extensionIdentifierWithPreRelease) => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease;
      const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
      if (criteria.compatible) {
        if (isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, criteria.targetPlatform)) {
          continue;
        }
        if (this.allowedExtensionsService.isAllowed({ id: extensionIdentifier.id, publisherDisplayName: rawGalleryExtension.publisher.displayName }) !== true) {
          continue;
        }
      }
      const rawGalleryExtensionVersion = await this.getValidRawGalleryExtensionVersion(
        rawGalleryExtension,
        rawGalleryExtension.versions,
        {
          compatible: criteria.compatible,
          targetPlatform: criteria.targetPlatform,
          productVersion: criteria.productVersion,
          version: criteria.versions?.find((extensionIdentifierWithVersion) => areSameExtensions(extensionIdentifierWithVersion, extensionIdentifier))?.version ?? (includePreRelease ? 2 /* Latest */ : 0 /* Release */)
        },
        allTargetPlatforms
      );
      const extension = rawGalleryExtensionVersion ? toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, this.productService, context) : null;
      if (!extension || extension.properties.isPreReleaseVersion && (!includePreRelease || !extension.hasReleaseVersion) || !extension.properties.isPreReleaseVersion && extension.properties.targetPlatform !== criteria.targetPlatform && extension.hasPreReleaseVersion) {
        needAllVersions.set(rawGalleryExtension.extensionId, index);
      } else {
        result.push([index, extension]);
      }
    }
    if (needAllVersions.size) {
      const stopWatch = new StopWatch();
      const query2 = new Query().withFlags(...flags.filter((flag) => flag !== Flag.IncludeLatestVersionOnly), Flag.IncludeVersions).withPage(1, needAllVersions.size).withFilter(FilterType.ExtensionId, ...needAllVersions.keys());
      const { extensions } = await this.queryGalleryExtensions(query2, criteria, extensionGalleryManifest, token);
      this.telemetryService.publicLog2("galleryService:additionalQuery", {
        duration: stopWatch.elapsed(),
        count: needAllVersions.size
      });
      for (const extension of extensions) {
        const index = needAllVersions.get(extension.identifier.uuid);
        result.push([index, extension]);
      }
    }
    return { extensions: result.sort((a, b) => a[0] - b[0]).map(([, extension]) => extension), total };
  }
  async getValidRawGalleryExtensionVersion(rawGalleryExtension, versions, criteria, allTargetPlatforms) {
    const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
    const rawGalleryExtensionVersions = sortExtensionVersions(versions, criteria.targetPlatform);
    if (criteria.compatible && isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, criteria.targetPlatform)) {
      return null;
    }
    const version = isString(criteria.version) ? criteria.version : void 0;
    for (let index = 0; index < rawGalleryExtensionVersions.length; index++) {
      const rawGalleryExtensionVersion = rawGalleryExtensionVersions[index];
      if (criteria.compatible) {
        await this.setEngineIfNotExists(extensionIdentifier.id, rawGalleryExtensionVersion);
      }
      if (await this.isValidVersion(
        {
          id: extensionIdentifier.id,
          version: rawGalleryExtensionVersion.version,
          isPreReleaseVersion: isPreReleaseVersion(rawGalleryExtensionVersion),
          targetPlatform: getTargetPlatformForExtensionVersion(rawGalleryExtensionVersion),
          engine: getEngine(rawGalleryExtensionVersion),
          manifestAsset: getVersionAsset(rawGalleryExtensionVersion, AssetType.Manifest),
          enabledApiProposals: getEnabledApiProposals(rawGalleryExtensionVersion)
        },
        criteria,
        rawGalleryExtension.publisher.displayName,
        allTargetPlatforms
      )) {
        return rawGalleryExtensionVersion;
      }
      if (version && rawGalleryExtensionVersion.version === version) {
        return null;
      }
    }
    if (version || criteria.compatible) {
      return null;
    }
    return rawGalleryExtension.versions[0];
  }
  async setEngineIfNotExists(extensionId, rawGalleryExtensionVersion) {
    if (getEngine(rawGalleryExtensionVersion)) {
      return;
    }
    try {
      const engine = await this.getEngine(extensionId, rawGalleryExtensionVersion.version, getVersionAsset(rawGalleryExtensionVersion, AssetType.Manifest));
      if (engine) {
        setEngine(rawGalleryExtensionVersion, engine);
      }
    } catch (error) {
      this.logService.error(`Error while getting the engine for the version ${rawGalleryExtensionVersion.version}.`, getErrorMessage(error));
    }
  }
  async queryRawGalleryExtensions(query, extensionGalleryManifest, token) {
    const extensionsQueryApi = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, ExtensionGalleryResourceType.ExtensionQueryService);
    if (!extensionsQueryApi) {
      throw new Error("No extension gallery query service configured.");
    }
    query = query.withFlags(...query.flags, Flag.ExcludeNonValidated).withFilter(FilterType.Target, "Microsoft.VisualStudio.Code");
    const unpublishedFlag = extensionGalleryManifest.capabilities.extensionQuery.flags?.find((f) => f.name === Flag.Unpublished);
    if (unpublishedFlag) {
      query = query.withFilter(FilterType.ExcludeWithFlags, String(unpublishedFlag.value));
    }
    const data = JSON.stringify({
      filters: [
        {
          criteria: query.criteria.reduce((criteria, c) => {
            const criterium = extensionGalleryManifest.capabilities.extensionQuery.filtering?.find((f) => f.name === c.filterType);
            if (criterium) {
              criteria.push({
                filterType: criterium.value,
                value: c.value
              });
            }
            return criteria;
          }, []),
          pageNumber: query.pageNumber,
          pageSize: query.pageSize,
          sortBy: extensionGalleryManifest.capabilities.extensionQuery.sorting?.find((s) => s.name === query.sortBy)?.value,
          sortOrder: query.sortOrder
        }
      ],
      assetTypes: query.assetTypes,
      flags: query.flags.reduce((flags, flag) => {
        const flagValue = extensionGalleryManifest.capabilities.extensionQuery.flags?.find((f) => f.name === flag);
        if (flagValue) {
          flags |= flagValue.value;
        }
        return flags;
      }, 0)
    });
    const commonHeaders = await this.commonHeadersPromise;
    const headers = {
      ...commonHeaders,
      "Content-Type": "application/json",
      "Accept": "application/json;api-version=3.0-preview.1",
      "Accept-Encoding": "gzip",
      "Content-Length": String(data.length)
    };
    const stopWatch = new StopWatch();
    let context, errorCode, total = 0;
    try {
      context = await this.requestService.request({
        type: "POST",
        url: extensionsQueryApi,
        data,
        headers,
        callSite: "extensionGalleryService.queryRawGalleryExtensions"
      }, token);
      if (context.res.statusCode && context.res.statusCode >= 400 && context.res.statusCode < 500) {
        return { galleryExtensions: [], total };
      }
      const result = await asJson(context);
      if (result) {
        const r = result.results[0];
        const galleryExtensions = r.extensions;
        const resultCount = r.resultMetadata && r.resultMetadata.filter((m) => m.metadataType === "ResultCount")[0];
        total = resultCount && resultCount.metadataItems.filter((i) => i.name === "TotalCount")[0].count || 0;
        return {
          galleryExtensions,
          total,
          context: context.res.headers["activityid"] ? {
            [SEARCH_ACTIVITY_HEADER_NAME]: context.res.headers["activityid"]
          } : {}
        };
      }
      return { galleryExtensions: [], total };
    } catch (e) {
      if (isCancellationError(e)) {
        errorCode = ExtensionGalleryErrorCode.Cancelled;
        throw e;
      } else {
        const errorMessage = getErrorMessage(e);
        errorCode = isOfflineError(e) ? ExtensionGalleryErrorCode.Offline : errorMessage.startsWith("XHR timeout") ? ExtensionGalleryErrorCode.Timeout : ExtensionGalleryErrorCode.Failed;
        throw new ExtensionGalleryError(errorMessage, errorCode);
      }
    } finally {
      this.telemetryService.publicLog2("galleryService:query", {
        filterTypes: query.criteria.map((criterium) => criterium.filterType),
        flags: query.flags,
        sortBy: query.sortBy,
        sortOrder: String(query.sortOrder),
        pageNumber: String(query.pageNumber),
        source: query.source,
        searchTextLength: query.searchText.length,
        requestBodySize: String(data.length),
        duration: stopWatch.elapsed(),
        success: !!context && isSuccess(context),
        responseBodySize: context?.res.headers["Content-Length"],
        statusCode: context ? String(context.res.statusCode) : void 0,
        errorCode,
        count: String(total),
        server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
        activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
        endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME)
      });
    }
  }
  getHeaderValue(headers, name) {
    const headerValue = headers?.[name.toLowerCase()];
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return value ? new TelemetryTrustedValue(value) : void 0;
  }
  async getLatestRawGalleryExtensionWithFallback(extensionInfo, resourceApi, token) {
    const [publisher, name] = extensionInfo.id.split(".");
    let errorCode;
    try {
      const uri = URI.parse(format2(resourceApi.uri, { publisher, name }));
      return await this.getLatestRawGalleryExtension(extensionInfo.id, uri, token);
    } catch (error) {
      if (error instanceof ExtensionGalleryError) {
        errorCode = error.code;
        switch (error.code) {
          case ExtensionGalleryErrorCode.Offline:
          case ExtensionGalleryErrorCode.Cancelled:
          case ExtensionGalleryErrorCode.Timeout:
          case ExtensionGalleryErrorCode.ClientError:
            throw error;
        }
      } else {
        errorCode = "Unknown";
      }
      if (!resourceApi.fallback) {
        throw error;
      }
    } finally {
      this.telemetryService.publicLog2("galleryService:getmarketplacelatest", {
        extension: extensionInfo.id,
        errorCode
      });
    }
    this.logService.error(`Error while getting the latest version for the extension ${extensionInfo.id} from ${resourceApi.uri}. Trying the fallback ${resourceApi.fallback}`, errorCode);
    try {
      const uri = URI.parse(format2(resourceApi.fallback, { publisher, name }));
      return await this.getLatestRawGalleryExtension(extensionInfo.id, uri, token);
    } catch (error) {
      errorCode = error instanceof ExtensionGalleryError ? error.code : "Unknown";
      throw error;
    } finally {
      this.telemetryService.publicLog2("galleryService:fallbacktounpkg", {
        extension: extensionInfo.id,
        errorCode
      });
    }
  }
  async getLatestRawGalleryExtension(extension, uri, token) {
    let context;
    let errorCode;
    const stopWatch = new StopWatch();
    try {
      const commonHeaders = await this.commonHeadersPromise;
      const headers = {
        ...commonHeaders,
        "Content-Type": "application/json",
        "Accept": "application/json;api-version=7.2-preview",
        "Accept-Encoding": "gzip"
      };
      context = await this.requestService.request({
        type: "GET",
        url: uri.toString(true),
        headers,
        timeout: this.getRequestTimeout(),
        callSite: "extensionGalleryService.getLatestRawGalleryExtension"
      }, token);
      if (context.res.statusCode === 404) {
        errorCode = "NotFound";
        return null;
      }
      if (context.res.statusCode && context.res.statusCode !== 200) {
        throw new Error("Unexpected HTTP response: " + context.res.statusCode);
      }
      const result = await asJson(context);
      if (!result) {
        errorCode = "NoData";
      }
      return result;
    } catch (error) {
      let galleryErrorCode;
      if (isCancellationError(error)) {
        galleryErrorCode = ExtensionGalleryErrorCode.Cancelled;
      } else if (isOfflineError(error)) {
        galleryErrorCode = ExtensionGalleryErrorCode.Offline;
      } else if (getErrorMessage(error).startsWith("XHR timeout")) {
        galleryErrorCode = ExtensionGalleryErrorCode.Timeout;
      } else if (context && isClientError(context)) {
        galleryErrorCode = ExtensionGalleryErrorCode.ClientError;
      } else if (context && isServerError(context)) {
        galleryErrorCode = ExtensionGalleryErrorCode.ServerError;
      } else {
        galleryErrorCode = ExtensionGalleryErrorCode.Failed;
      }
      errorCode = galleryErrorCode;
      throw new ExtensionGalleryError(error, galleryErrorCode);
    } finally {
      this.telemetryService.publicLog2("galleryService:getLatest", {
        extension,
        host: uri.authority,
        duration: stopWatch.elapsed(),
        errorCode,
        statusCode: context?.res.statusCode && context?.res.statusCode !== 200 ? `${context.res.statusCode}` : void 0,
        server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
        activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
        endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME)
      });
    }
  }
  async reportStatistic(publisher, name, version, type) {
    if (isWeb) {
      this.logService.info("ExtensionGalleryService#reportStatistic: Skipped in web");
      return void 0;
    }
    const manifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!manifest) {
      return void 0;
    }
    const resource = getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.ExtensionStatisticsUri);
    if (!resource) {
      return;
    }
    const url = format2(resource, { publisher, name, version, statTypeName: type });
    const Accept = "*/*;api-version=4.0-preview.1";
    const commonHeaders = await this.commonHeadersPromise;
    const headers = { ...commonHeaders, Accept };
    try {
      await this.requestService.request({
        type: "POST",
        url,
        headers,
        callSite: "extensionGalleryService.reportStatistic"
      }, CancellationToken.None);
    } catch (error) {
    }
  }
  async download(extension, location, operation) {
    this.logService.trace("ExtensionGalleryService#download", extension.identifier.id);
    const data = getGalleryExtensionTelemetryData(extension);
    const startTime = (/* @__PURE__ */ new Date()).getTime();
    const operationParam = operation === InstallOperation.Install ? "install" : operation === InstallOperation.Update ? "update" : "";
    const downloadAsset = operationParam ? {
      uri: `${extension.assets.download.uri}${URI.parse(extension.assets.download.uri).query ? "&" : "?"}${operationParam}=true`,
      fallbackUri: `${extension.assets.download.fallbackUri}${URI.parse(extension.assets.download.fallbackUri).query ? "&" : "?"}${operationParam}=true`
    } : extension.assets.download;
    const activityId = extension.queryContext?.[SEARCH_ACTIVITY_HEADER_NAME];
    const headers = activityId && typeof activityId === "string" ? { [SEARCH_ACTIVITY_HEADER_NAME]: activityId } : void 0;
    const context = await this.getAsset(extension.identifier.id, downloadAsset, AssetType.VSIX, extension.version, "extensionGalleryService.download", headers ? { headers } : void 0);
    try {
      await this.fileService.writeFile(location, context.stream);
    } catch (error) {
      try {
        await this.fileService.del(location);
      } catch (e) {
        this.logService.warn(`Error while deleting the file ${location.toString()}`, getErrorMessage(e));
      }
      throw new ExtensionGalleryError(getErrorMessage(error), ExtensionGalleryErrorCode.DownloadFailedWriting);
    }
    this.telemetryService.publicLog("galleryService:downloadVSIX", { ...data, duration: (/* @__PURE__ */ new Date()).getTime() - startTime });
  }
  async downloadSignatureArchive(extension, location) {
    if (!extension.assets.signature) {
      throw new Error("No signature asset found");
    }
    this.logService.trace("ExtensionGalleryService#downloadSignatureArchive", extension.identifier.id);
    const context = await this.getAsset(extension.identifier.id, extension.assets.signature, AssetType.Signature, extension.version, "extensionGalleryService.signature");
    try {
      await this.fileService.writeFile(location, context.stream);
    } catch (error) {
      try {
        await this.fileService.del(location);
      } catch (e) {
        this.logService.warn(`Error while deleting the file ${location.toString()}`, getErrorMessage(e));
      }
      throw new ExtensionGalleryError(getErrorMessage(error), ExtensionGalleryErrorCode.DownloadFailedWriting);
    }
  }
  async getReadme(extension, token) {
    if (extension.assets.readme) {
      const context = await this.getAsset(extension.identifier.id, extension.assets.readme, AssetType.Details, extension.version, "extensionGalleryService.readme", {}, token);
      const content = await asTextOrError(context);
      return content || "";
    }
    return "";
  }
  async getManifest(extension, token) {
    if (extension.assets.manifest) {
      const context = await this.getAsset(extension.identifier.id, extension.assets.manifest, AssetType.Manifest, extension.version, "extensionGalleryService.manifest", {}, token);
      const text = await asTextOrError(context);
      return text ? JSON.parse(text) : null;
    }
    return null;
  }
  async getCoreTranslation(extension, languageId) {
    const asset = extension.assets.coreTranslations.filter((t) => t[0] === languageId.toUpperCase())[0];
    if (asset) {
      const context = await this.getAsset(extension.identifier.id, asset[1], asset[0], extension.version, "extensionGalleryService.coreTranslation");
      const text = await asTextOrError(context);
      return text ? JSON.parse(text) : null;
    }
    return null;
  }
  async getChangelog(extension, token) {
    if (extension.assets.changelog) {
      const context = await this.getAsset(extension.identifier.id, extension.assets.changelog, AssetType.Changelog, extension.version, "extensionGalleryService.changelog", {}, token);
      const content = await asTextOrError(context);
      return content || "";
    }
    return "";
  }
  async getAllVersions(extensionIdentifier) {
    return this.getVersions(extensionIdentifier);
  }
  async getAllCompatibleVersions(extensionIdentifier, includePreRelease, targetPlatform) {
    return this.getVersions(extensionIdentifier, { version: includePreRelease ? 2 /* Latest */ : 0 /* Release */, targetPlatform });
  }
  async getVersions(extensionIdentifier, onlyCompatible) {
    const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!extensionGalleryManifest) {
      throw new Error("No extension gallery service configured.");
    }
    let query = new Query().withFlags(Flag.IncludeVersions, Flag.IncludeCategoryAndTags, Flag.IncludeFiles, Flag.IncludeVersionProperties).withPage(1, 1);
    if (extensionIdentifier.uuid) {
      query = query.withFilter(FilterType.ExtensionId, extensionIdentifier.uuid);
    } else {
      query = query.withFilter(FilterType.ExtensionName, extensionIdentifier.id);
    }
    const { galleryExtensions } = await this.queryRawGalleryExtensions(query, extensionGalleryManifest, CancellationToken.None);
    if (!galleryExtensions.length) {
      return [];
    }
    const allTargetPlatforms = getAllTargetPlatforms(galleryExtensions[0]);
    if (onlyCompatible && isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, onlyCompatible.targetPlatform)) {
      return [];
    }
    const versions = [];
    const productVersion = { version: this.productService.version, date: this.productService.date };
    await Promise.all(galleryExtensions[0].versions.map(async (version) => {
      try {
        if (await this.isValidVersion(
          {
            id: extensionIdentifier.id,
            version: version.version,
            isPreReleaseVersion: isPreReleaseVersion(version),
            targetPlatform: getTargetPlatformForExtensionVersion(version),
            engine: getEngine(version),
            manifestAsset: getVersionAsset(version, AssetType.Manifest),
            enabledApiProposals: getEnabledApiProposals(version)
          },
          {
            compatible: !!onlyCompatible,
            productVersion,
            targetPlatform: onlyCompatible?.targetPlatform,
            version: onlyCompatible?.version ?? version.version
          },
          galleryExtensions[0].publisher.displayName,
          allTargetPlatforms
        )) {
          versions.push(version);
        }
      } catch (error) {
      }
    }));
    const result = [];
    const seen = /* @__PURE__ */ new Map();
    for (const version of sortExtensionVersions(versions, onlyCompatible?.targetPlatform ?? CURRENT_TARGET_PLATFORM)) {
      const index = seen.get(version.version);
      const existing = index !== void 0 ? result[index] : void 0;
      const targetPlatform = getTargetPlatformForExtensionVersion(version);
      if (!existing) {
        seen.set(version.version, result.length);
        result.push({ version: version.version, date: version.lastUpdated, isPreReleaseVersion: isPreReleaseVersion(version), targetPlatforms: [targetPlatform] });
      } else {
        existing.targetPlatforms.push(targetPlatform);
      }
    }
    return result;
  }
  async getAsset(extension, asset, assetType, extensionVersion, callSite, options = {}, token = CancellationToken.None) {
    const commonHeaders = await this.commonHeadersPromise;
    const baseOptions = { type: "GET" };
    const headers = { ...commonHeaders, ...options.headers || {} };
    options = { ...options, ...baseOptions, headers };
    const url = asset.uri;
    const fallbackUrl = asset.fallbackUri;
    const firstOptions = { ...options, url, timeout: this.getRequestTimeout(), callSite };
    let context;
    try {
      context = await this.requestService.request(firstOptions, token);
      if (context.res.statusCode === 200) {
        return context;
      }
      const message = await asTextOrError(context);
      throw new Error(`Expected 200, got back ${context.res.statusCode} instead.

${message}`);
    } catch (err) {
      if (isCancellationError(err)) {
        throw err;
      }
      const message = getErrorMessage(err);
      this.telemetryService.publicLog2("galleryService:cdnFallback", {
        extension,
        assetType,
        message,
        extensionVersion,
        server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
        activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
        endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME)
      });
      const fallbackOptions = { ...options, url: fallbackUrl, timeout: this.getRequestTimeout(), callSite: `${callSite}.fallback` };
      return this.requestService.request(fallbackOptions, token);
    }
  }
  async getExtensionsControlManifest() {
    const manifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!manifest) {
      throw new Error("No extension gallery service configured.");
    }
    if (!this.extensionsControlUrl) {
      return { malicious: [], deprecated: {}, search: [], autoUpdate: {} };
    }
    const context = await this.requestService.request({
      type: "GET",
      url: this.extensionsControlUrl,
      timeout: this.getRequestTimeout(),
      callSite: "extensionGalleryService.getExtensionsControlManifest"
    }, CancellationToken.None);
    if (context.res.statusCode !== 200) {
      throw new Error("Could not get extensions report.");
    }
    const result = await asJson(context);
    const malicious = [];
    const deprecated = {};
    const search = [];
    const autoUpdate = result?.autoUpdate ?? {};
    if (result) {
      for (const id of result.malicious) {
        if (!isString(id)) {
          continue;
        }
        const publisherOrExtension = EXTENSION_IDENTIFIER_REGEX.test(id) ? { id } : id;
        malicious.push({ extensionOrPublisher: publisherOrExtension, learnMoreLink: result.learnMoreLinks?.[id] });
      }
      if (result.migrateToPreRelease) {
        for (const [unsupportedPreReleaseExtensionId, preReleaseExtensionInfo] of Object.entries(result.migrateToPreRelease)) {
          if (!preReleaseExtensionInfo.engine || isEngineValid(preReleaseExtensionInfo.engine, this.productService.version, this.productService.date)) {
            deprecated[unsupportedPreReleaseExtensionId.toLowerCase()] = {
              disallowInstall: true,
              extension: {
                id: preReleaseExtensionInfo.id,
                displayName: preReleaseExtensionInfo.displayName,
                autoMigrate: { storage: !!preReleaseExtensionInfo.migrateStorage },
                preRelease: true
              }
            };
          }
        }
      }
      if (result.deprecated) {
        for (const [deprecatedExtensionId, deprecationInfo] of Object.entries(result.deprecated)) {
          if (deprecationInfo) {
            deprecated[deprecatedExtensionId.toLowerCase()] = isBoolean(deprecationInfo) ? {} : deprecationInfo;
          }
        }
      }
      if (result.search) {
        for (const s of result.search) {
          search.push(s);
        }
      }
    }
    deprecated[this.productService.defaultChatAgent.extensionId.toLowerCase()] = {
      disallowInstall: true,
      extension: {
        id: this.productService.defaultChatAgent.chatExtensionId,
        displayName: "GitHub Copilot Chat",
        autoMigrate: { storage: false, donotDisable: true },
        preRelease: this.productService.quality !== "stable"
      }
    };
    return { malicious, deprecated, search, autoUpdate };
  }
  getRequestTimeout() {
    const configuredTimeout = this.configurationService.getValue(ExtensionRequestsTimeoutConfigKey);
    return isNumber(configuredTimeout) && configuredTimeout >= 0 ? configuredTimeout : 6e4;
  }
};
AbstractExtensionGalleryService = __decorateClass([
  __decorateParam(1, IRequestService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAllowedExtensionsService),
  __decorateParam(9, IExtensionGalleryManifestService)
], AbstractExtensionGalleryService);
let ExtensionGalleryService = class extends AbstractExtensionGalleryService {
  constructor(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
    super(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService);
  }
};
ExtensionGalleryService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IRequestService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAllowedExtensionsService),
  __decorateParam(9, IExtensionGalleryManifestService)
], ExtensionGalleryService);
let ExtensionGalleryServiceWithNoStorageService = class extends AbstractExtensionGalleryService {
  constructor(requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
    super(void 0, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService);
  }
};
ExtensionGalleryServiceWithNoStorageService = __decorateClass([
  __decorateParam(0, IRequestService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IProductService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IAllowedExtensionsService),
  __decorateParam(8, IExtensionGalleryManifestService)
], ExtensionGalleryServiceWithNoStorageService);
export {
  AbstractExtensionGalleryService,
  ExtensionGalleryService,
  ExtensionGalleryServiceWithNoStorageService,
  filterLatestExtensionVersionsForTargetPlatform,
  sortExtensionVersions
};
