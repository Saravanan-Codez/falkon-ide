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
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { IBannerService } from "../../../services/banner/browser/bannerService.js";
import { asJson, IRequestService } from "../../../../platform/request/common/request.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { arch, platform } from "../../../../base/common/process.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { equals } from "../../../../base/common/arrays.js";
import { IntervalTimer } from "../../../../base/common/async.js";
import { mainWindow } from "../../../../base/browser/window.js";
const POLLING_INTERVAL = 60 * 60 * 1e3;
const BANNER_ID = "emergencyAlert.banner";
let EmergencyAlert = class extends Disposable {
  constructor(bannerService, requestService, productService, logService) {
    super();
    this.bannerService = bannerService;
    this.requestService = requestService;
    this.productService = productService;
    this.logService = logService;
    const emergencyAlertUrl = productService.emergencyAlertUrl;
    if (!emergencyAlertUrl) {
      return;
    }
    this.fetchAlerts(emergencyAlertUrl);
    const pollingTimer = this._register(new IntervalTimer());
    pollingTimer.cancelAndSet(() => this.fetchAlerts(emergencyAlertUrl), POLLING_INTERVAL, mainWindow);
  }
  static {
    this.ID = "workbench.contrib.emergencyAlert";
  }
  async fetchAlerts(url) {
    try {
      await this.doFetchAlerts(url);
    } catch (e) {
      this.logService.error(e);
    }
  }
  async doFetchAlerts(url) {
    const requestResult = await this.requestService.request({ type: "GET", url, disableCache: true, timeout: 2e4, callSite: "emergencyAlert.doFetchAlerts" }, CancellationToken.None);
    if (requestResult.res.statusCode !== 200) {
      throw new Error(`Failed to fetch emergency alerts: HTTP ${requestResult.res.statusCode}`);
    }
    const emergencyAlerts = await asJson(requestResult);
    if (!emergencyAlerts || !Array.isArray(emergencyAlerts.alerts)) {
      this.dismissAlert();
      return;
    }
    const matchingAlert = emergencyAlerts.alerts.find(
      (alert) => alert.commit === this.productService.commit && (!alert.platform || alert.platform === platform) && (!alert.arch || alert.arch === arch)
    );
    if (!matchingAlert) {
      this.dismissAlert();
      return;
    }
    if (this.currentAlertMessage === matchingAlert.message && equals(this.currentAlertActions ?? [], matchingAlert.actions ?? [], (a, b) => a.label === b.label && a.href === b.href)) {
      return;
    }
    this.currentAlertMessage = matchingAlert.message;
    this.currentAlertActions = matchingAlert.actions;
    this.bannerService.show({
      id: BANNER_ID,
      icon: Codicon.warning,
      message: matchingAlert.message,
      actions: matchingAlert.actions
    });
  }
  dismissAlert() {
    if (this.currentAlertMessage !== void 0) {
      this.currentAlertMessage = void 0;
      this.currentAlertActions = void 0;
      this.bannerService.hide(BANNER_ID);
    }
  }
};
EmergencyAlert = __decorateClass([
  __decorateParam(0, IBannerService),
  __decorateParam(1, IRequestService),
  __decorateParam(2, IProductService),
  __decorateParam(3, ILogService)
], EmergencyAlert);
registerWorkbenchContribution2(EmergencyAlert.ID, EmergencyAlert, WorkbenchPhase.Eventually);
export {
  EmergencyAlert
};
