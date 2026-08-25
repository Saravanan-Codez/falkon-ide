import { createDecorator } from "../../platform/instantiation/common/instantiation.js";
const IExtensionHostStatusService = createDecorator("extensionHostStatusService");
class ExtensionHostStatusService {
  constructor() {
    this._exitInfo = /* @__PURE__ */ new Map();
  }
  setExitInfo(reconnectionToken, info) {
    this._exitInfo.set(reconnectionToken, info);
  }
  getExitInfo(reconnectionToken) {
    return this._exitInfo.get(reconnectionToken) || null;
  }
}
export {
  ExtensionHostStatusService,
  IExtensionHostStatusService
};
