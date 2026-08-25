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
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IBannerService } from "../../../services/banner/browser/bannerService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { URI } from "../../../../base/common/uri.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
let WelcomeBannerContribution = class {
  static {
    this.WELCOME_BANNER_DISMISSED_KEY = "workbench.banner.welcome.dismissed";
  }
  constructor(bannerService, storageService, environmentService) {
    const welcomeBanner = environmentService.options?.welcomeBanner;
    if (!welcomeBanner) {
      return;
    }
    if (storageService.getBoolean(WelcomeBannerContribution.WELCOME_BANNER_DISMISSED_KEY, StorageScope.PROFILE, false)) {
      return;
    }
    let icon = void 0;
    if (typeof welcomeBanner.icon === "string") {
      icon = ThemeIcon.fromId(welcomeBanner.icon);
    } else if (welcomeBanner.icon) {
      icon = URI.revive(welcomeBanner.icon);
    }
    bannerService.show({
      id: "welcome.banner",
      message: welcomeBanner.message,
      icon,
      actions: welcomeBanner.actions,
      onClose: () => {
        storageService.store(WelcomeBannerContribution.WELCOME_BANNER_DISMISSED_KEY, true, StorageScope.PROFILE, StorageTarget.MACHINE);
      }
    });
  }
};
WelcomeBannerContribution = __decorateClass([
  __decorateParam(0, IBannerService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IBrowserWorkbenchEnvironmentService)
], WelcomeBannerContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WelcomeBannerContribution, LifecyclePhase.Restored);
