import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { connectionTokenQueryName } from "../../../base/common/network.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { AhpJsonlLogger, getAhpLogByteLength } from "../common/ahpJsonlLogger.js";
import { AgentHostTransportKind } from "../common/agentHostTelemetry.js";
import { JSON_RPC_PARSE_ERROR } from "../common/state/sessionProtocol.js";
class WebSocketProtocolTransport extends Disposable {
  constructor(_ws, _WebSocket, _ahpLogger) {
    super();
    this._ws = _ws;
    this._WebSocket = _WebSocket;
    this._ahpLogger = _ahpLogger;
    this.transportKind = AgentHostTransportKind.WebSocket;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onClose = this._register(new Emitter());
    this.onClose = this._onClose.event;
    if (this._ahpLogger) {
      this._register(this._ahpLogger);
    }
    this._ws.on("message", (data) => {
      try {
        const text = typeof data === "string" ? data : data.toString("utf-8");
        const message = JSON.parse(text);
        this._ahpLogger?.log(message, "c2s", getAhpLogByteLength(text));
        this._onMessage.fire(message);
      } catch {
        this.send({ jsonrpc: "2.0", id: null, error: { code: JSON_RPC_PARSE_ERROR, message: "Parse error" } });
      }
    });
    this._ws.on("close", () => {
      this._onClose.fire();
    });
    this._ws.on("error", () => {
      this._onClose.fire();
    });
  }
  send(message) {
    if (this._ws.readyState === this._WebSocket.OPEN) {
      const text = JSON.stringify(message);
      this._ahpLogger?.log(message, "s2c", getAhpLogByteLength(text));
      this._ws.send(text);
    }
  }
  dispose() {
    this._ws.close();
    super.dispose();
  }
}
class WebSocketProtocolServer extends Disposable {
  constructor(options, _logService, _ahpLogOptions, ws, http, url) {
    super();
    this._logService = _logService;
    this._ahpLogOptions = _ahpLogOptions;
    this._connectionCount = 0;
    this._onConnection = this._register(new Emitter());
    this.onConnection = this._onConnection.event;
    this._WebSocket = ws.WebSocket;
    const opts = typeof options === "number" ? { port: options } : options;
    const host = opts.host ?? "127.0.0.1";
    const verifyClient = opts.connectionTokenValidate ? (info, cb) => {
      const parsedUrl = url.parse(info.req.url ?? "", true);
      const token = parsedUrl.query[connectionTokenQueryName];
      if (!opts.connectionTokenValidate(token)) {
        this._logService.warn("[WebSocketProtocol] Connection rejected: invalid connection token");
        cb(false, 403, "Forbidden");
        return;
      }
      cb(true);
    } : void 0;
    if (opts.socketPath) {
      this._httpServer = http.createServer();
      this._wss = new ws.WebSocketServer({ server: this._httpServer, verifyClient });
      const httpServer = this._httpServer;
      this.whenListening = new Promise((resolve, reject) => {
        httpServer.once("listening", () => {
          this._logService.info(`[WebSocketProtocol] Server listening on socket ${opts.socketPath}`);
          resolve();
        });
        httpServer.once("error", reject);
      });
      this._httpServer.listen(opts.socketPath);
    } else {
      this._wss = new ws.WebSocketServer({ port: opts.port, host, verifyClient });
      const wss = this._wss;
      this.whenListening = new Promise((resolve, reject) => {
        wss.once("listening", () => {
          const addr = wss.address();
          const bound = !addr || typeof addr === "string" ? `${host}:${opts.port}` : `${addr.address}:${addr.port}`;
          this._logService.info(`[WebSocketProtocol] Server listening on ${bound}`);
          resolve();
        });
        wss.once("error", reject);
      });
    }
    this._wss.on("connection", (wsConn) => {
      this._logService.trace("[WebSocketProtocol] New client connection");
      const transport = new WebSocketProtocolTransport(wsConn, this._WebSocket, this._createAhpLogger());
      this._onConnection.fire(transport);
    });
    this._wss.on("error", (err) => {
      this._logService.error("[WebSocketProtocol] Server error", err);
    });
  }
  get address() {
    const addr = this._wss.address();
    if (!addr || typeof addr === "string") {
      return addr ?? void 0;
    }
    return `${addr.address}:${addr.port}`;
  }
  /**
   * The actual TCP port the server is bound to. `undefined` when the
   * listener has not bound yet (await {@link whenListening} first) or
   * when the server is bound to a unix socket / named pipe.
   */
  get boundPort() {
    const addr = this._wss.address();
    if (!addr || typeof addr === "string") {
      return void 0;
    }
    return addr.port;
  }
  /**
   * Creates a new WebSocket protocol server. Dynamically imports `ws`,
   * `http`, and `url` so callers don't pay the cost when unused.
   */
  static async create(options, logService, ahpLogOptions) {
    const [ws, http, url] = await Promise.all([
      import("ws"),
      import("http"),
      import("url")
    ]);
    return new WebSocketProtocolServer(options, logService, ahpLogOptions, ws, http, url);
  }
  _createAhpLogger() {
    if (!this._ahpLogOptions) {
      return void 0;
    }
    return this._ahpLogOptions.instantiationService.createInstance(
      AhpJsonlLogger,
      {
        logsHome: this._ahpLogOptions.logsHome,
        connectionId: `agent-host-${++this._connectionCount}-${generateUuid()}`,
        transport: "websocket"
      }
    );
  }
  dispose() {
    this._wss.close();
    this._httpServer?.close();
    super.dispose();
  }
}
export {
  WebSocketProtocolServer,
  WebSocketProtocolTransport
};
