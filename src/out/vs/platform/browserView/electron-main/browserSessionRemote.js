import { Emitter } from "../../../base/common/event.js";
import { BrowserViewStorageScope } from "../common/browserView.js";
class BrowserSessionRemote {
  constructor(_session) {
    this._session = _session;
    this._readyPromise = Promise.resolve();
    /** Live references held by view id; the proxy is cleared at zero. */
    this._viewIds = /* @__PURE__ */ new Set();
    this._onDidStart = new Emitter();
    this.onDidStart = this._onDidStart.event;
    this._onDidStop = new Emitter();
    this.onDidStop = this._onDidStop.event;
  }
  get isRemote() {
    return this._proxy !== void 0;
  }
  get proxy() {
    return this._proxy;
  }
  get whenReady() {
    return this._readyPromise;
  }
  acquire(viewId, proxyInfo) {
    if (!proxyInfo || this._session.storageScope === BrowserViewStorageScope.Global) {
      this.release(viewId);
      return;
    }
    this._viewIds.add(viewId);
    this._setProxy(proxyInfo);
  }
  release(viewId) {
    if (!this._viewIds.delete(viewId)) {
      return;
    }
    if (this._viewIds.size === 0) {
      this._setProxy(void 0);
    }
  }
  _setProxy(info) {
    if (sameProxyInfo(this._proxy, info)) {
      return;
    }
    const wasRemote = this._proxy !== void 0;
    this._proxy = info;
    this._readyPromise = this._applyProxy();
    if (info) {
      this._onDidStart.fire();
    } else if (wasRemote) {
      this._onDidStop.fire();
    }
  }
  _applyProxy() {
    if (this._proxy) {
      return this._session.electronSession.setProxy({
        proxyRules: this._proxy.url,
        proxyBypassRules: "<-loopback>"
      });
    }
    return this._session.electronSession.setProxy({ mode: "direct" });
  }
}
function sameProxyInfo(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.url === b.url && a.certFingerprint === b.certFingerprint && a.credentials.username === b.credentials.username && a.credentials.password === b.credentials.password;
}
export {
  BrowserSessionRemote
};
