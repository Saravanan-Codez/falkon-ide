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
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IMeteredConnectionService } from "../../../../platform/meteredConnection/common/meteredConnection.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
let MeteredConnectionStatusContribution = class extends Disposable {
  constructor(meteredConnectionService, statusbarService) {
    super();
    this.meteredConnectionService = meteredConnectionService;
    this.statusbarService = statusbarService;
    this.statusBarEntry = this._register(new MutableDisposable());
    this.updateStatusBarEntry(this.meteredConnectionService.isConnectionMetered);
    this._register(this.meteredConnectionService.onDidChangeIsConnectionMetered((isMetered) => {
      this.updateStatusBarEntry(isMetered);
    }));
  }
  static {
    this.ID = "workbench.contrib.meteredConnectionStatus";
  }
  updateStatusBarEntry(isMetered) {
    if (isMetered) {
      if (!this.statusBarEntry.value) {
        this.statusBarEntry.value = this.statusbarService.addEntry(
          this.getStatusBarEntry(),
          MeteredConnectionStatusContribution.ID,
          StatusbarAlignment.RIGHT,
          -Number.MAX_VALUE
          // Show at the far right
        );
      }
    } else {
      this.statusBarEntry.clear();
    }
  }
  getStatusBarEntry() {
    return {
      name: localize("status.meteredConnection", "Metered Connection"),
      text: "$(radio-tower)",
      ariaLabel: localize("status.meteredConnection.ariaLabel", "Metered Connection Enabled"),
      tooltip: localize("status.meteredConnection.tooltip", "Metered connection enabled. Some automatic features like extension updates, Settings Sync, and automatic Git operations are paused to reduce data usage."),
      command: {
        id: "workbench.action.configureMeteredConnection",
        title: localize("status.meteredConnection.configure", "Configure")
      },
      showInAllWindows: true
    };
  }
};
MeteredConnectionStatusContribution = __decorateClass([
  __decorateParam(0, IMeteredConnectionService),
  __decorateParam(1, IStatusbarService)
], MeteredConnectionStatusContribution);
export {
  MeteredConnectionStatusContribution
};
