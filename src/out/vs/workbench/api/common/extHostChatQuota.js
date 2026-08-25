import { Disposable } from "../../../base/common/lifecycle.js";
import { MainContext } from "./extHost.protocol.js";
class ExtHostChatQuota extends Disposable {
  constructor(mainContext) {
    super();
    this._proxy = mainContext.getProxy(MainContext.MainThreadChatQuota);
  }
  updateQuotas(quotas) {
    this._proxy.$updateQuotas(quotas);
  }
}
export {
  ExtHostChatQuota
};
