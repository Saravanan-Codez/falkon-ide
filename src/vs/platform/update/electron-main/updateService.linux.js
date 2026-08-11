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
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IMeteredConnectionService } from "../../meteredConnection/common/meteredConnection.js";
import { INativeHostMainService } from "../../native/electron-main/nativeHostMainService.js";
import { IProductService } from "../../product/common/productService.js";
import { asJson, IRequestService } from "../../request/common/request.js";
import { IApplicationStorageMainService } from "../../storage/electron-main/storageMainService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { State, StateType, UpdateType } from "../common/update.js";
import { AbstractUpdateService, createUpdateURL } from "./abstractUpdateService.js";
let LinuxUpdateService = class extends AbstractUpdateService {
  constructor(lifecycleMainService, configurationService, environmentMainService, requestService, logService, nativeHostMainService, productService, telemetryService, applicationStorageMainService, meteredConnectionService) {
    super(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService, telemetryService, applicationStorageMainService, meteredConnectionService, false);
    this.nativeHostMainService = nativeHostMainService;
  }
  buildUpdateFeedUrl(quality, commit, options) {
    return createUpdateURL(this.productService.updateUrl, `linux-${process.arch}`, quality, commit, options);
  }
  doCheckForUpdates(explicit, _pendingCommit) {
    if (!this.quality) {
      return;
    }
    const internalOrg = this.getInternalOrg();
    const background = !explicit && !internalOrg;
    const url = this.buildUpdateFeedUrl(this.quality, this.productService.commit, { background, internalOrg });
    this.setState(State.CheckingForUpdates(explicit));
    this.requestService.request({ url, callSite: "updateService.linux.checkForUpdates" }, CancellationToken.None).then(asJson).then((update) => {
      if (this.state.type !== StateType.CheckingForUpdates) {
        return;
      }
      if (!update || !update.url || !update.version || !update.productVersion) {
        this.setState(State.Idle(UpdateType.Archive, void 0, explicit || void 0));
      } else {
        this.setState(State.AvailableForDownload(update));
      }
    }).then(void 0, (err) => {
      if (this.state.type !== StateType.CheckingForUpdates) {
        return;
      }
      this.logService.error(err);
      const message = explicit ? err.message || err : void 0;
      this.setState(State.Idle(UpdateType.Archive, message));
    });
  }
  async doDownloadUpdate(state) {
    if (this.productService.downloadUrl && this.productService.downloadUrl.length > 0) {
      this.nativeHostMainService.openExternal(void 0, this.productService.downloadUrl);
    } else if (state.update.url) {
      this.nativeHostMainService.openExternal(void 0, state.update.url);
    }
    this.setState(State.Idle(UpdateType.Archive));
  }
};
LinuxUpdateService = __decorateClass([
  __decorateParam(0, ILifecycleMainService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IEnvironmentMainService),
  __decorateParam(3, IRequestService),
  __decorateParam(4, ILogService),
  __decorateParam(5, INativeHostMainService),
  __decorateParam(6, IProductService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IApplicationStorageMainService),
  __decorateParam(9, IMeteredConnectionService)
], LinuxUpdateService);
export {
  LinuxUpdateService
};
