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
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { IOpenerService } from "../../../platform/opener/common/opener.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IHostService } from "../../services/host/browser/host.js";
import { IUserActivityService } from "../../services/userActivity/common/userActivityService.js";
import { encodeBase64 } from "../../../base/common/buffer.js";
let MainThreadWindow = class {
  constructor(extHostContext, hostService, openerService, userActivityService) {
    this.hostService = hostService;
    this.openerService = openerService;
    this.userActivityService = userActivityService;
    this.disposables = new DisposableStore();
    this.proxy = extHostContext.getProxy(ExtHostContext.ExtHostWindow);
    Event.latch(hostService.onDidChangeFocus)(this.proxy.$onDidChangeWindowFocus, this.proxy, this.disposables);
    userActivityService.onDidChangeIsActive(this.proxy.$onDidChangeWindowActive, this.proxy, this.disposables);
    this.registerNativeHandle();
  }
  dispose() {
    this.disposables.dispose();
  }
  registerNativeHandle() {
    Event.latch(this.hostService.onDidChangeActiveWindow)(
      async (windowId) => {
        const handle = await this.hostService.getNativeWindowHandle(windowId);
        this.proxy.$onDidChangeActiveNativeWindowHandle(handle ? encodeBase64(handle) : void 0);
      },
      this,
      this.disposables
    );
  }
  $getInitialState() {
    return Promise.resolve({
      isFocused: this.hostService.hasFocus,
      isActive: this.userActivityService.isActive
    });
  }
  async $openUri(uriComponents, uriString, options) {
    const uri = URI.from(uriComponents);
    let target;
    if (uriString && URI.parse(uriString).toString() === uri.toString()) {
      target = uriString;
    } else {
      target = uri;
    }
    return this.openerService.open(target, {
      openExternal: true,
      allowTunneling: options.allowTunneling,
      allowContributedOpeners: options.allowContributedOpeners
    });
  }
  async $asExternalUri(uriComponents, options) {
    const result = await this.openerService.resolveExternalUri(URI.revive(uriComponents), options);
    return result.resolved;
  }
};
MainThreadWindow = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadWindow),
  __decorateParam(1, IHostService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IUserActivityService)
], MainThreadWindow);
export {
  MainThreadWindow
};
