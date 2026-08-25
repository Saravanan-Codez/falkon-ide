import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { IBrowserViewWorkbenchService, IBrowserViewCDPService } from "../common/browserView.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
class WebBrowserViewWorkbenchService {
  constructor() {
    this.onDidChangeBrowserViews = Event.None;
    this.onDidChangeSharingAvailable = Event.None;
    this.isSharingAvailable = false;
    this._known = /* @__PURE__ */ new Map();
  }
  willUseRemoteProxy() {
    return false;
  }
  setRemoteProxyInfo(_info) {
  }
  getKnownBrowserViews() {
    return this._known;
  }
  registerContextualFilter(_filter) {
    return Disposable.None;
  }
  getContextualBrowserViews() {
    return this._known;
  }
  async getPreferredGroup(preferredGroup) {
    return preferredGroup;
  }
  registerOpenHandler(_handler) {
    return Disposable.None;
  }
  getOrCreateLazy(_id, _state) {
    throw new Error("Integrated Browser is not available in web.");
  }
  getBrowserViewModel(_id) {
    return void 0;
  }
  async clearGlobalStorage() {
  }
  async clearWorkspaceStorage() {
  }
}
class WebBrowserViewCDPService {
  async createSessionGroup(_browserId) {
    throw new Error("Integrated Browser is not available in web.");
  }
  async destroySessionGroup(_groupId) {
  }
  async sendCDPMessage(_groupId, _message) {
  }
  onCDPMessage(_groupId) {
    return Event.None;
  }
  onDidDestroy(_groupId) {
    return Event.None;
  }
}
registerSingleton(IBrowserViewWorkbenchService, WebBrowserViewWorkbenchService, InstantiationType.Delayed);
registerSingleton(IBrowserViewCDPService, WebBrowserViewCDPService, InstantiationType.Delayed);
