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
import { Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IProductService } from "../../product/common/productService.js";
import { ExtensionGalleryResourceType, Flag, ExtensionGalleryManifestStatus } from "./extensionGalleryManifest.js";
import { FilterType, SortBy } from "./extensionManagement.js";
let ExtensionGalleryManifestService = class extends Disposable {
  constructor(productService) {
    super();
    this.productService = productService;
    this.onDidChangeExtensionGalleryManifest = Event.None;
    this.onDidChangeExtensionGalleryManifestStatus = Event.None;
  }
  get extensionGalleryManifestStatus() {
    return !!this.productService.extensionsGallery?.serviceUrl ? ExtensionGalleryManifestStatus.Available : ExtensionGalleryManifestStatus.Unavailable;
  }
  async getExtensionGalleryManifest() {
    const extensionsGallery = this.productService.extensionsGallery;
    if (!extensionsGallery?.serviceUrl) {
      return null;
    }
    const resources = [
      {
        id: `${extensionsGallery.serviceUrl}/extensionquery`,
        type: ExtensionGalleryResourceType.ExtensionQueryService
      },
      {
        id: `${extensionsGallery.serviceUrl}/vscode/{publisher}/{name}/latest`,
        type: ExtensionGalleryResourceType.ExtensionLatestVersionUri
      },
      {
        id: `${extensionsGallery.serviceUrl}/publishers/{publisher}/extensions/{name}/{version}/stats?statType={statTypeName}`,
        type: ExtensionGalleryResourceType.ExtensionStatisticsUri
      }
    ];
    if (extensionsGallery.publisherUrl) {
      resources.push({
        id: `${extensionsGallery.publisherUrl}/{publisher}`,
        type: ExtensionGalleryResourceType.PublisherViewUri
      });
    }
    if (extensionsGallery.itemUrl) {
      resources.push({
        id: `${extensionsGallery.itemUrl}?itemName={publisher}.{name}`,
        type: ExtensionGalleryResourceType.ExtensionDetailsViewUri
      });
      resources.push({
        id: `${extensionsGallery.itemUrl}?itemName={publisher}.{name}&ssr=false#review-details`,
        type: ExtensionGalleryResourceType.ExtensionRatingViewUri
      });
    }
    if (extensionsGallery.resourceUrlTemplate) {
      resources.push({
        id: extensionsGallery.resourceUrlTemplate,
        type: ExtensionGalleryResourceType.ExtensionResourceUri
      });
    }
    const filtering = [
      {
        name: FilterType.Tag,
        value: 1
      },
      {
        name: FilterType.ExtensionId,
        value: 4
      },
      {
        name: FilterType.Category,
        value: 5
      },
      {
        name: FilterType.ExtensionName,
        value: 7
      },
      {
        name: FilterType.Target,
        value: 8
      },
      {
        name: FilterType.Featured,
        value: 9
      },
      {
        name: FilterType.SearchText,
        value: 10
      },
      {
        name: FilterType.ExcludeWithFlags,
        value: 12
      }
    ];
    const sorting = [
      {
        name: SortBy.NoneOrRelevance,
        value: 0
      },
      {
        name: SortBy.LastUpdatedDate,
        value: 1
      },
      {
        name: SortBy.Title,
        value: 2
      },
      {
        name: SortBy.PublisherName,
        value: 3
      },
      {
        name: SortBy.InstallCount,
        value: 4
      },
      {
        name: SortBy.AverageRating,
        value: 6
      },
      {
        name: SortBy.PublishedDate,
        value: 10
      },
      {
        name: SortBy.WeightedRating,
        value: 12
      }
    ];
    const flags = [
      {
        name: Flag.None,
        value: 0
      },
      {
        name: Flag.IncludeVersions,
        value: 1
      },
      {
        name: Flag.IncludeFiles,
        value: 2
      },
      {
        name: Flag.IncludeCategoryAndTags,
        value: 4
      },
      {
        name: Flag.IncludeSharedAccounts,
        value: 8
      },
      {
        name: Flag.IncludeVersionProperties,
        value: 16
      },
      {
        name: Flag.ExcludeNonValidated,
        value: 32
      },
      {
        name: Flag.IncludeInstallationTargets,
        value: 64
      },
      {
        name: Flag.IncludeAssetUri,
        value: 128
      },
      {
        name: Flag.IncludeStatistics,
        value: 256
      },
      {
        name: Flag.IncludeLatestVersionOnly,
        value: 512
      },
      {
        name: Flag.Unpublished,
        value: 4096
      },
      {
        name: Flag.IncludeNameConflictInfo,
        value: 32768
      },
      {
        name: Flag.IncludeLatestPrereleaseAndStableVersionOnly,
        value: 65536
      }
    ];
    return {
      version: "",
      resources,
      capabilities: {
        extensionQuery: {
          filtering,
          sorting,
          flags
        },
        signing: {
          allPublicRepositorySigned: true
        }
      }
    };
  }
};
ExtensionGalleryManifestService = __decorateClass([
  __decorateParam(0, IProductService)
], ExtensionGalleryManifestService);
export {
  ExtensionGalleryManifestService
};
