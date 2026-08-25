import { Disposable } from "../../../base/common/lifecycle.js";
import { isMacintosh } from "../../../base/common/platform.js";
import { localize } from "../../../nls.js";
import { StateType } from "../common/update.js";
class NotAvailableUpdateDialog extends Disposable {
  constructor(updateService, dialogMainService, windowsMainService) {
    super();
    this._register(updateService.onStateChange((state) => {
      if (state.type !== StateType.Idle || !state.notAvailable || state.error) {
        return;
      }
      if (!isMacintosh || windowsMainService.getWindowCount() > 0) {
        return;
      }
      dialogMainService.showMessageBox({
        type: "info",
        message: localize("noUpdatesAvailable", "There are currently no updates available.")
      });
    }));
  }
}
export {
  NotAvailableUpdateDialog
};
