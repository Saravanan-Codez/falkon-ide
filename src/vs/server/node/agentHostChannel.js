import { Emitter, Event } from "../../base/common/event.js";
import { Disposable } from "../../base/common/lifecycle.js";
import { connectionTokenQueryName } from "../../base/common/network.js";
const agentHostProxyUnavailableMessage = "Agent host proxy is not available because no upstream agent host endpoint was configured.";
let _wsModule;
async function loadWs() {
  return _wsModule ??= await import("ws");
}
let _netModule;
async function loadNet() {
  return _netModule ??= await import("net");
}
class UnavailableAgentHostChannel {
  listen(_ctx, event) {
    switch (event) {
      case "frame":
      case "close":
        return Event.None;
    }
    throw new Error(`Invalid listen: ${event}`);
  }
  call(_ctx, command) {
    switch (command) {
      case "connect":
        return Promise.reject(new Error(agentHostProxyUnavailableMessage));
      case "send":
      case "close":
        return Promise.resolve(void 0);
    }
    return Promise.reject(new Error(`Invalid call: ${command}`));
  }
}
const defaultUpstreamFactory = (logService) => (endpoint) => new WebSocketUpstreamConnection(endpoint, logService);
class LazyUpstreamConnection extends Disposable {
  constructor(_resolveEndpoint, _upstreamFactory, _logService) {
    super();
    this._resolveEndpoint = _resolveEndpoint;
    this._upstreamFactory = _upstreamFactory;
    this._logService = _logService;
    this._onFrame = this._register(new Emitter());
    this.onFrame = this._onFrame.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._closeFired = false;
  }
  async connect() {
    if (this._store.isDisposed) {
      throw new Error("UpstreamConnection is disposed");
    }
    const connectPromise = this._connectPromise ??= this._connect();
    try {
      await connectPromise;
    } catch (error) {
      if (this._connectPromise === connectPromise) {
        this._connectPromise = void 0;
      }
      throw error;
    }
  }
  send(frame) {
    const connection = this._connection;
    if (!connection) {
      this._logService.warn("[AgentHostChannel] Drop send: upstream not open");
      this._fireClose();
      return;
    }
    connection.send(frame);
  }
  async _connect() {
    const endpoint = await this._resolveEndpoint();
    if (this._store.isDisposed) {
      throw new Error("UpstreamConnection is disposed");
    }
    const connection = this._upstreamFactory(endpoint);
    this._connection = connection;
    this._register(connection);
    this._register(connection.onFrame((frame) => this._onFrame.fire(frame)));
    this._register(connection.onClose(() => this._fireClose()));
    try {
      await connection.connect();
    } catch (error) {
      this._connection = void 0;
      connection.dispose();
      throw error;
    }
  }
  dispose() {
    this._fireClose();
    super.dispose();
  }
  _fireClose() {
    if (this._closeFired) {
      return;
    }
    this._closeFired = true;
    this._onClose.fire();
  }
}
class WebSocketUpstreamConnection extends Disposable {
  constructor(_endpoint, _logService) {
    super();
    this._endpoint = _endpoint;
    this._logService = _logService;
    this._onFrame = this._register(new Emitter());
    this.onFrame = this._onFrame.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    this._closeFired = false;
  }
  connect() {
    if (this._store.isDisposed) {
      return Promise.reject(new Error("UpstreamConnection is disposed"));
    }
    return this._connectPromise ??= this._doConnect();
  }
  async _doConnect() {
    const ws = await loadWs();
    const url = this._buildUrl();
    const wsOptions = await this._buildWsOptions();
    this._logService.info(`[AgentHostChannel] Opening upstream to ${this._endpoint.socketPath ?? url}`);
    const socket = new ws.WebSocket(url, wsOptions);
    this._ws = socket;
    return new Promise((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        this._logService.trace("[AgentHostChannel] Upstream open");
        socket.on("message", (data) => {
          const text = typeof data === "string" ? data : data.toString("utf-8");
          this._onFrame.fire(text);
        });
        socket.on("close", () => this._fireClose());
        socket.on("error", (err) => {
          this._logService.warn("[AgentHostChannel] Upstream error", err);
          this._fireClose();
        });
        resolve();
      };
      const onError = (err) => {
        cleanup();
        this._logService.warn("[AgentHostChannel] Upstream connection failed", err);
        this._fireClose();
        reject(err);
      };
      const onClose = () => {
        cleanup();
        this._fireClose();
        reject(new Error("Upstream closed before connect"));
      };
      const cleanup = () => {
        socket.removeListener("open", onOpen);
        socket.removeListener("error", onError);
        socket.removeListener("close", onClose);
      };
      socket.on("open", onOpen);
      socket.on("error", onError);
      socket.on("close", onClose);
    });
  }
  send(frame) {
    const ws = this._ws;
    if (!ws || ws.readyState !== ws.OPEN) {
      this._logService.warn("[AgentHostChannel] Drop send: upstream not open");
      this._fireClose();
      return;
    }
    ws.send(frame);
  }
  dispose() {
    this._ws?.close();
    this._fireClose();
    super.dispose();
  }
  _fireClose() {
    if (this._closeFired) {
      return;
    }
    this._closeFired = true;
    this._onClose.fire();
  }
  _buildUrl() {
    const host = this._endpoint.host ?? "localhost";
    const port = this._endpoint.port ?? "0";
    let url = `ws://${host}:${port}`;
    if (this._endpoint.connectionToken) {
      url += `?${connectionTokenQueryName}=${encodeURIComponent(this._endpoint.connectionToken)}`;
    }
    return url;
  }
  async _buildWsOptions() {
    if (!this._endpoint.socketPath) {
      return void 0;
    }
    const net = await loadNet();
    const socketPath = this._endpoint.socketPath;
    const createConnection = (() => net.createConnection(socketPath));
    return { createConnection };
  }
}
class AgentHostChannel extends Disposable {
  constructor(ipcServer, _endpoint, _logService, upstreamFactory) {
    super();
    this._endpoint = _endpoint;
    this._logService = _logService;
    this._perCtx = /* @__PURE__ */ new Map();
    this._upstreamFactory = upstreamFactory ?? defaultUpstreamFactory(_logService);
    this._register(ipcServer.onDidRemoveConnection((c) => this._disposeCtx(c.ctx)));
  }
  listen(ctx, event) {
    const conn = this._getOrCreate(ctx);
    switch (event) {
      case "frame":
        return conn.onFrame;
      case "close":
        return conn.onClose;
    }
    throw new Error(`Invalid listen: ${event}`);
  }
  async call(ctx, command, arg) {
    const conn = this._getOrCreate(ctx);
    switch (command) {
      case "connect":
        this._logService.info(`[AgentHostChannel] Renderer ctx=${String(ctx)} requested connect to upstream`);
        await conn.connect();
        return void 0;
      case "send":
        if (typeof arg !== "string") {
          throw new Error("send: arg must be a string frame");
        }
        conn.send(arg);
        return void 0;
      case "close":
        this._disposeCtx(ctx);
        return void 0;
    }
    throw new Error(`Invalid call: ${command}`);
  }
  dispose() {
    for (const conn of this._perCtx.values()) {
      conn.dispose();
    }
    this._perCtx.clear();
    super.dispose();
  }
  _getOrCreate(ctx) {
    let conn = this._perCtx.get(ctx);
    if (!conn) {
      conn = typeof this._endpoint === "function" ? new LazyUpstreamConnection(() => this._resolveEndpoint(), this._upstreamFactory, this._logService) : this._upstreamFactory(this._endpoint);
      this._perCtx.set(ctx, conn);
      const sub = conn.onClose(() => {
        sub.dispose();
        if (this._perCtx.get(ctx) === conn) {
          this._perCtx.delete(ctx);
        }
      });
    }
    return conn;
  }
  async _resolveEndpoint() {
    const endpoint = this._endpoint;
    if (typeof endpoint !== "function") {
      return endpoint;
    }
    const endpointPromise = this._endpointPromise ??= Promise.resolve().then(() => endpoint());
    try {
      return await endpointPromise;
    } finally {
      if (this._endpointPromise === endpointPromise) {
        this._endpointPromise = void 0;
      }
    }
  }
  _disposeCtx(ctx) {
    const conn = this._perCtx.get(ctx);
    if (conn) {
      this._perCtx.delete(ctx);
      conn.dispose();
    }
  }
}
export {
  AgentHostChannel,
  UnavailableAgentHostChannel
};
