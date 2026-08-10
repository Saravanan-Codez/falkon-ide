import { Duplex } from "stream";
import { findFreePortFaster } from "../../../base/node/ports.js";
import { NodeSocket } from "../../../base/parts/ipc/node/ipc.net.js";
import { SocketCloseEventType } from "../../../base/parts/ipc/common/ipc.net.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Limiter } from "../../../base/common/async.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { generateSelfSignedCert } from "./selfSignedCert.js";
const MAX_CONCURRENT_TUNNEL_CONNECTS = 6;
class TunnelProxy extends Disposable {
  constructor(_connectTunnel, _logService) {
    super();
    this._connectTunnel = _connectTunnel;
    this._logService = _logService;
    this._localPort = 0;
    /**
     * Sockets we took over from the HTTPS server via CONNECT. Once the
     * CONNECT handler runs the server no longer tracks them, so
     * `server.close()` and `server.closeAllConnections()` won't terminate
     * them — we have to destroy them ourselves on dispose to release the
     * listening port promptly.
     */
    this._connectSockets = /* @__PURE__ */ new Set();
    /**
     * The remote (tunnel) side of every active bridge — both CONNECT
     * tunnels and pooled plain-HTTP sockets. We destroy these explicitly
     * and synchronously on dispose rather than relying on the local
     * socket's async `'close'` to propagate `end()`; during shared-process
     * teardown the event loop may not get another turn to fire that
     * listener, which would leave the upstream tunnel socket dangling.
     */
    this._remoteSockets = /* @__PURE__ */ new Set();
    /**
     * Bounds how many tunnels we create concurrently through the remote
     * agent. Gates the setup (connect + handshake) only; once a tunnel is
     * established the slot is released and data piping proceeds unthrottled.
     */
    this._connectLimiter = this._register(new Limiter(MAX_CONCURRENT_TUNNEL_CONNECTS));
  }
  get localPort() {
    return this._localPort;
  }
  async start() {
    const crypto = await import("crypto");
    const http = await import("http");
    const https = await import("https");
    const username = crypto.randomBytes(16).toString("hex");
    const password = crypto.randomBytes(32).toString("hex");
    this._credentials = { username, password };
    this._expectedAuthHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    const { key, cert, fingerprint } = await generateSelfSignedCert();
    this._certFingerprint = fingerprint;
    this._http = http;
    this._tunnelAgent = this._createTunnelAgent();
    const server = https.createServer({ key, cert }, (req, res) => this._onRequest(req, res));
    server.on("connect", (req, socket, head) => this._onConnect(req, socket, head));
    server.on("error", (err) => {
      this._logService.error("[TunnelProxy] Server error:", err);
    });
    this._server = server;
    const port = await findFreePortFaster(0, 2, 1e3, "127.0.0.1");
    server.listen(port, "127.0.0.1");
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    this._localPort = address.port;
    this._logService.info(`[TunnelProxy] Listening on https://127.0.0.1:${this._localPort}`);
    return {
      url: `https://127.0.0.1:${this._localPort}`,
      host: "127.0.0.1",
      port: this._localPort,
      credentials: this._credentials,
      certFingerprint: this._certFingerprint
    };
  }
  dispose() {
    for (const socket of this._connectSockets) {
      socket.destroy();
    }
    this._connectSockets.clear();
    for (const socket of this._remoteSockets) {
      socket.destroy();
    }
    this._remoteSockets.clear();
    this._tunnelAgent?.destroy();
    this._server?.closeAllConnections();
    this._server?.close();
    super.dispose();
  }
  /**
   * Verify the `Proxy-Authorization` header against our credentials.
   * Returns `true` if the request is authorized.
   */
  _checkAuth(authHeader) {
    return authHeader === this._expectedAuthHeader;
  }
  /**
   * Create an `http.Agent` that pools tunnel sockets by target
   * host:port. Node calls `createConnection` only when no pooled socket
   * is available for the target; otherwise it reuses an existing one.
   */
  _createTunnelAgent() {
    if (!this._http) {
      throw new Error("HTTP module not initialized");
    }
    const agent = new this._http.Agent({ keepAlive: true });
    agent.createConnection = (options, oncreate) => {
      const host = options.hostname || options.host || "";
      const port = Number(options.port) || 80;
      this._createTunnelSocket(host, port).then((socket) => oncreate?.(null, socket)).catch((err) => oncreate?.(err, null));
    };
    return agent;
  }
  /**
   * Drop every pooled keep-alive tunnel socket by recreating the
   * agent. Called when the upstream tunnel endpoint changes: the pooled
   * sockets all dial the now-stale endpoint, so they would be reset en
   * masse once it goes away. Recreating the agent closes the idle ones
   * gracefully and forces subsequent requests to dial the new endpoint.
   */
  drainConnectionPool() {
    if (!this._tunnelAgent) {
      return;
    }
    const oldAgent = this._tunnelAgent;
    this._tunnelAgent = this._createTunnelAgent();
    oldAgent?.destroy();
    this._logService.trace("[TunnelProxy] Upstream endpoint changed; drained pooled tunnel sockets");
  }
  /**
   * Handle HTTP CONNECT requests (used for HTTPS tunneling).
   * Parses `host:port` from the request URL, establishes a tunnel
   * through the remote agent, and pipes the sockets together.
   */
  async _onConnect(req, socket, head) {
    this._connectSockets.add(socket);
    socket.on("close", () => this._connectSockets.delete(socket));
    if (!this._checkAuth(req.headers["proxy-authorization"])) {
      socket.write(
        'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="TunnelProxy"\r\n\r\n'
      );
      socket.end();
      return;
    }
    const { host, port } = this._parseHostPort(req.url ?? "", 443);
    if (!host) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.end();
      return;
    }
    this._logService.trace(`[TunnelProxy] CONNECT ${host}:${port}`);
    try {
      socket.pause();
      const protocol = await this._connectLimiter.queue(() => this._connectTunnel(host, port));
      const { stream: remoteSocket, leftover } = this._takeRemoteStream(protocol);
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (leftover.byteLength > 0) {
        socket.write(leftover.buffer);
      }
      if (head.length > 0) {
        remoteSocket.write(head);
      }
      this._bridgeSockets(socket, remoteSocket);
    } catch (err) {
      this._logService.error(`[TunnelProxy] Failed to tunnel to ${host}:${port}:`, err);
      socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      socket.end();
    }
  }
  /**
   * Handle plain HTTP requests (GET, POST, etc. with absolute URLs).
   *
   * Chromium sends proxied HTTP requests with absolute-form URLs
   * (e.g. `GET http://example.com/page HTTP/1.1`) and reuses keep-alive
   * connections to the proxy for requests to **different** hosts.
   *
   * Each request is forwarded via `http.request` using a shared
   * `http.Agent` that pools tunnel sockets by host:port. The agent
   * calls `_createTunnelSocket` only when no pooled socket is available;
   * otherwise it reuses an existing tunnel connection.
   */
  async _onRequest(req, res) {
    if (!this._checkAuth(req.headers["proxy-authorization"])) {
      res.writeHead(407, { "Proxy-Authenticate": 'Basic realm="TunnelProxy"' });
      res.end();
      return;
    }
    let parsed;
    try {
      parsed = new URL(req.url ?? "");
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (parsed.protocol !== "http:") {
      this._logService.warn(`[TunnelProxy] Rejecting non-HTTP forwarded request: ${req.method} ${req.url}`);
      res.writeHead(400);
      res.end();
      return;
    }
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10) || 80;
    if (!host) {
      res.writeHead(400);
      res.end();
      return;
    }
    this._logService.trace(`[TunnelProxy] ${req.method} ${host}:${port}${parsed.pathname}`);
    try {
      const http = await import("http");
      const path = parsed.pathname + parsed.search;
      const headers = { ...req.headers };
      const connectionTokens = (headers["connection"] ?? "").toString().split(",").map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
      for (const token of connectionTokens) {
        delete headers[token];
      }
      delete headers["connection"];
      delete headers["keep-alive"];
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      delete headers["te"];
      delete headers["transfer-encoding"];
      delete headers["upgrade"];
      const proxyReq = http.request({
        agent: this._tunnelAgent,
        hostname: host,
        port,
        path,
        method: req.method,
        headers
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on("error", (err) => {
        this._logService.error(`[TunnelProxy] Proxy request error for ${host}:${port}:`, err);
        res.destroy();
      });
      req.pipe(proxyReq);
    } catch (err) {
      this._logService.error(`[TunnelProxy] Failed to tunnel to ${host}:${port}:`, err);
      res.destroy();
    }
  }
  /**
   * Create a `net.Socket`-compatible stream backed by a remote agent
   * tunnel. Called by the `http.Agent` when it needs a new connection
   * to a given host:port (i.e. no pooled socket is available).
   */
  async _createTunnelSocket(host, port) {
    const protocol = await this._connectLimiter.queue(() => this._connectTunnel(host, port));
    const { stream: tunnelStream, leftover } = this._takeRemoteStream(protocol);
    this._trackRemoteSocket(tunnelStream);
    if (leftover.byteLength > 0) {
      tunnelStream.unshift(leftover.buffer);
    }
    return tunnelStream;
  }
  /**
   * Take ownership of a freshly-connected tunnel's transport as a Node
   * {@link Duplex} stream, together with any bytes the protocol already
   * buffered during the handshake (the caller routes that leftover to the
   * appropriate side).
   *
   * Two transports occur in practice:
   * - {@link NodeSocket} (classic/websocket server): unwrap the raw
   *   `net.Socket` so we can rely on Node's native stream backpressure (via
   *   `pipe()` and the keep-alive `http.Agent`).
   * - a generic {@link ISocket} (managed / exec-server connection): there is
   *   no `net.Socket` underneath, so adapt the message-passing socket to a
   *   {@link Duplex} ({@link RemoteSocketStream}).
   */
  _takeRemoteStream(protocol) {
    const remoteSocket = protocol.getSocket();
    if (remoteSocket instanceof NodeSocket) {
      const socket = remoteSocket.socket;
      const leftover2 = protocol.readEntireBuffer();
      remoteSocket.dispose(false);
      protocol.dispose();
      return { stream: socket, leftover: leftover2 };
    }
    const leftover = protocol.readEntireBuffer();
    protocol.dispose();
    return { stream: new RemoteSocketStream(remoteSocket), leftover };
  }
  /**
   * Parse a `host:port` string. Falls back to `defaultPort` when the
   * port component is missing. Returns an empty host when the address
   * is empty or the port is outside the valid TCP range (1-65535), per
   * RFC 9110 section 9.3.6 ("A server MUST reject a CONNECT request that
   * targets an empty or invalid port number").
   */
  _parseHostPort(address, defaultPort) {
    let host;
    let port;
    const bracketMatch = /^\[(?<host>[^\]]+)\]:(?<port>\d+)$/.exec(address);
    if (bracketMatch?.groups) {
      host = bracketMatch.groups["host"];
      port = parseInt(bracketMatch.groups["port"], 10);
    } else {
      const bracketOnly = /^\[(?<host>[^\]]+)\]$/.exec(address);
      if (bracketOnly?.groups) {
        host = bracketOnly.groups["host"];
        port = defaultPort;
      } else {
        const lastColon = address.lastIndexOf(":");
        if (lastColon === -1) {
          host = address;
          port = defaultPort;
        } else {
          const maybePort = parseInt(address.substring(lastColon + 1), 10);
          if (isNaN(maybePort)) {
            host = address;
            port = defaultPort;
          } else {
            host = address.substring(0, lastColon);
            port = maybePort;
          }
        }
      }
    }
    if (port < 1 || port > 65535) {
      return { host: "", port: 0 };
    }
    return { host, port };
  }
  _bridgeSockets(localSocket, remoteSocket) {
    this._trackRemoteSocket(remoteSocket);
    remoteSocket.on("end", () => localSocket.end());
    remoteSocket.on("close", () => localSocket.end());
    remoteSocket.on("error", () => localSocket.destroy());
    localSocket.on("end", () => remoteSocket.end());
    localSocket.on("close", () => remoteSocket.end());
    localSocket.on("error", () => remoteSocket.destroy());
    remoteSocket.pipe(localSocket);
    localSocket.pipe(remoteSocket);
  }
  /**
   * Track a remote tunnel socket so {@link dispose} can tear it down
   * synchronously. The socket auto-removes itself once closed.
   */
  _trackRemoteSocket(socket) {
    this._remoteSockets.add(socket);
    socket.on("error", () => socket.destroy());
    socket.on("close", () => this._remoteSockets.delete(socket));
  }
}
class RemoteSocketStream extends Duplex {
  constructor(_socket) {
    super();
    this._socket = _socket;
    this._disposables = new DisposableStore();
    this._disposables.add(this._socket.onData((data) => this.push(data.buffer)));
    this._disposables.add(this._socket.onEnd(() => this.push(null)));
    this._disposables.add(this._socket.onClose((e) => {
      this.destroy(e?.type === SocketCloseEventType.NodeSocketCloseEvent ? e.error : void 0);
    }));
  }
  // The keep-alive http.Agent pools tunnel sockets and calls net.Socket-only
  // transport knobs on them (setKeepAlive/ref/unref, and setTimeout/setNoDelay
  // while wiring a request) when parking or reusing a connection. A generic
  // ISocket has no such knobs, so expose no-op shims to keep the agent happy;
  // otherwise freeing a pooled managed socket throws (e.g.
  // "socket.setKeepAlive is not a function").
  setKeepAlive() {
    return this;
  }
  setNoDelay() {
    return this;
  }
  setTimeout() {
    return this;
  }
  ref() {
    return this;
  }
  unref() {
    return this;
  }
  _read() {
  }
  _write(chunk, _encoding, callback) {
    this._socket.write(VSBuffer.wrap(chunk));
    this._socket.drain().then(() => callback(), (err) => callback(err));
  }
  _final(callback) {
    this._socket.end();
    callback();
  }
  _destroy(error, callback) {
    this._disposables.dispose();
    this._socket.dispose();
    callback(error);
  }
}
export {
  TunnelProxy
};
