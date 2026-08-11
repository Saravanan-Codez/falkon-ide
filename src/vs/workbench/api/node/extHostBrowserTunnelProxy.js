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
import { DeferredPromise } from "../../../base/common/async.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { connectRemoteAgentTunnel } from "../../../platform/remote/common/remoteAgentConnection.js";
import { RemoteConnectionType } from "../../../platform/remote/common/remoteAuthorityResolver.js";
import { nodeSocketFactory } from "../../../platform/remote/node/nodeSocketFactory.js";
import { TunnelProxy } from "../../../platform/tunnel/node/tunnelProxy.js";
import { MainContext } from "../common/extHost.protocol.js";
import { IExtHostExtensionService } from "../common/extHostExtensionService.js";
import { IExtHostManagedSockets } from "../common/extHostManagedSockets.js";
import { IExtHostInitDataService } from "../common/extHostInitDataService.js";
import { IExtHostRpcService } from "../common/extHostRpcService.js";
import { ExtHostManagedSocket } from "./extHostTunnelService.js";
import { ISignService } from "../../../platform/sign/common/sign.js";
let NodeExtHostBrowserTunnelProxy = class extends Disposable {
  constructor(extHostRpc, _initData, _signService, _logService, _managedSockets, extHostExtensionService) {
    super();
    this._initData = _initData;
    this._signService = _signService;
    this._logService = _logService;
    this._managedSockets = _managedSockets;
    this._addressProvider = new MutableAddressProvider();
    this._enabled = false;
    this._connection = null;
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadBrowserTunnelProxy);
    this._setConnection(extHostExtensionService.getRemoteConnectionData());
    this._register(extHostExtensionService.onDidChangeRemoteConnectionData(() => this._setConnection(extHostExtensionService.getRemoteConnectionData())));
  }
  dispose() {
    this._stop();
    super.dispose();
  }
  $setEnabled(enabled) {
    if (this._initData.remote.isRemote) {
      return;
    }
    if (this._enabled === enabled) {
      return;
    }
    this._enabled = enabled;
    this._update();
  }
  _setConnection(connection) {
    if (!connection) {
      return;
    }
    const changed = !!this._connection && !sameConnection(this._connection, connection);
    this._connection = connection;
    this._addressProvider.setAddress({ connectTo: connection.connectTo, connectionToken: connection.connectionToken });
    if (changed) {
      this._tunnelProxy?.drainConnectionPool();
    }
  }
  _update() {
    if (this._enabled && !this._tunnelProxy && !this._startPromise) {
      this._start();
    } else if (!this._enabled) {
      this._stop();
    }
  }
  _start() {
    const options = this._createConnectionOptions();
    const tunnelProxy = new TunnelProxy(
      (host, port) => connectRemoteAgentTunnel(options, host, port),
      this._logService
    );
    const startPromise = tunnelProxy.start().then((info) => {
      if (this._startPromise !== startPromise) {
        tunnelProxy.dispose();
        return;
      }
      this._tunnelProxy = tunnelProxy;
      this._startPromise = void 0;
      this._proxy.$updateProxyInfo(info);
    }, (err) => {
      this._logService.error("[ExtHostBrowserTunnelProxy] Failed to start tunnel proxy:", err);
      if (this._startPromise === startPromise) {
        this._startPromise = void 0;
      }
      tunnelProxy.dispose();
    });
    this._startPromise = startPromise;
  }
  _stop() {
    const wasActive = !!this._tunnelProxy || !!this._startPromise;
    this._tunnelProxy?.dispose();
    this._tunnelProxy = void 0;
    this._startPromise = void 0;
    if (wasActive) {
      this._proxy.$updateProxyInfo(void 0);
    }
  }
  _createConnectionOptions() {
    const managedSockets = this._managedSockets;
    const remoteSocketFactoryService = {
      _serviceBrand: void 0,
      async connect(connectTo, path, query, debugLabel) {
        if (connectTo.type === RemoteConnectionType.Managed) {
          const result = await managedSockets.makeConnection();
          return ExtHostManagedSocket.connect(result, path, query, debugLabel);
        }
        return nodeSocketFactory.connect(connectTo, path, query, debugLabel);
      },
      register() {
        throw new Error("BrowserTunnelProxy socket factory does not support register()");
      }
    };
    return {
      commit: this._initData.commit,
      quality: this._initData.quality,
      addressProvider: this._addressProvider,
      remoteSocketFactoryService,
      signService: this._signService,
      logService: this._logService,
      ipcLogger: null
    };
  }
};
NodeExtHostBrowserTunnelProxy = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService),
  __decorateParam(2, ISignService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IExtHostManagedSockets),
  __decorateParam(5, IExtHostExtensionService)
], NodeExtHostBrowserTunnelProxy);
class MutableAddressProvider {
  constructor() {
    this._address = null;
    this._pending = null;
  }
  getAddress() {
    if (this._address) {
      return Promise.resolve(this._address);
    }
    this._pending ??= new DeferredPromise();
    return this._pending.p;
  }
  setAddress(address) {
    this._address = address;
    this._pending?.complete(address);
    this._pending = null;
  }
}
function sameConnection(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.connectionToken !== b.connectionToken) {
    return false;
  }
  const x = a.connectTo;
  const y = b.connectTo;
  if (x.type === RemoteConnectionType.Managed && y.type === RemoteConnectionType.Managed) {
    return x.id === y.id;
  }
  if (x.type === RemoteConnectionType.WebSocket && y.type === RemoteConnectionType.WebSocket) {
    return x.host === y.host && x.port === y.port;
  }
  return false;
}
export {
  NodeExtHostBrowserTunnelProxy
};
