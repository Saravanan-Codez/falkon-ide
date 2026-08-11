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
import { Emitter } from "../../../base/common/event.js";
import { JsonRpcProtocol } from "../../../base/common/jsonRpcProtocol.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { ILoggerService } from "../../log/common/log.js";
import { isInitializeMessage, McpGatewaySession } from "./mcpGatewaySession.js";
let McpGatewayService = class extends Disposable {
  constructor(loggerService) {
    super();
    /** All active routes keyed by their route UUID */
    this._routes = /* @__PURE__ */ new Map();
    /** Maps gatewayId → set of route UUIDs belonging to that gateway */
    this._gatewayRoutes = /* @__PURE__ */ new Map();
    /** Maps gatewayId → serverId → routeId for reverse lookup */
    this._gatewayServerRoutes = /* @__PURE__ */ new Map();
    /** Maps gatewayId to clientId for tracking ownership */
    this._gatewayToClient = /* @__PURE__ */ new Map();
    /** Per-gateway disposables (e.g. event listeners) */
    this._gatewayDisposables = /* @__PURE__ */ new Map();
    this._logger = this._register(loggerService.createLogger("mcpGateway", { name: "MCP Gateway", logLevel: "always" }));
    this._logger.info("[McpGatewayService] Initialized");
  }
  async createGateway(clientId, toolInvoker) {
    await this._ensureServer();
    if (this._port === void 0) {
      throw new Error("[McpGatewayService] Server failed to start, port is undefined");
    }
    if (!toolInvoker) {
      throw new Error("[McpGatewayService] Tool invoker is required to create gateway");
    }
    const gatewayId = generateUuid();
    const routeIds = /* @__PURE__ */ new Set();
    const serverRouteMap = /* @__PURE__ */ new Map();
    this._gatewayRoutes.set(gatewayId, routeIds);
    this._gatewayServerRoutes.set(gatewayId, serverRouteMap);
    const disposables = new DisposableStore();
    this._gatewayDisposables.set(gatewayId, disposables);
    try {
      const serverDescriptors = toolInvoker.listServers();
      const servers = [];
      for (const descriptor of serverDescriptors) {
        const serverInfo = this._createRouteForServer(gatewayId, descriptor.id, descriptor.label, toolInvoker, routeIds, serverRouteMap);
        servers.push(serverInfo);
      }
      if (clientId) {
        this._gatewayToClient.set(gatewayId, clientId);
        this._logger.info(`[McpGatewayService] Created gateway ${gatewayId} with ${servers.length} server(s) for client ${clientId}`);
      } else {
        this._logger.warn(`[McpGatewayService] Created gateway ${gatewayId} with ${servers.length} server(s) without client tracking`);
      }
      const onDidChangeServers = disposables.add(new Emitter());
      disposables.add(toolInvoker.onDidChangeServers((newDescriptors) => {
        this._refreshGatewayServers(gatewayId, newDescriptors, toolInvoker, routeIds, serverRouteMap, onDidChangeServers);
      }));
      return {
        servers,
        onDidChangeServers: onDidChangeServers.event,
        gatewayId
      };
    } catch (error) {
      this._cleanupGateway(gatewayId);
      throw error;
    }
  }
  _refreshGatewayServers(gatewayId, newDescriptors, toolInvoker, routeIds, serverRouteMap, onDidChangeServers) {
    if (!this._gatewayRoutes.has(gatewayId)) {
      return;
    }
    const newServerIds = new Set(newDescriptors.map((d) => d.id));
    const existingServerIds = new Set(serverRouteMap.keys());
    for (const serverId of existingServerIds) {
      if (!newServerIds.has(serverId)) {
        const routeId = serverRouteMap.get(serverId);
        if (routeId) {
          this._disposeRoute(routeId);
          routeIds.delete(routeId);
          serverRouteMap.delete(serverId);
        }
      }
    }
    for (const descriptor of newDescriptors) {
      if (!existingServerIds.has(descriptor.id)) {
        this._createRouteForServer(gatewayId, descriptor.id, descriptor.label, toolInvoker, routeIds, serverRouteMap);
        continue;
      }
      const routeId = serverRouteMap.get(descriptor.id);
      const route = routeId ? this._routes.get(routeId) : void 0;
      if (route && route.label !== descriptor.label) {
        route.label = descriptor.label;
      }
    }
    const updatedServers = this._getGatewayServers(gatewayId);
    this._logger.info(`[McpGatewayService] Gateway ${gatewayId} servers changed: ${updatedServers.length} server(s)`);
    onDidChangeServers.fire(updatedServers);
  }
  _cleanupGateway(gatewayId) {
    const routeIds = this._gatewayRoutes.get(gatewayId);
    if (routeIds) {
      for (const routeId of routeIds) {
        this._disposeRoute(routeId);
      }
    }
    this._gatewayRoutes.delete(gatewayId);
    this._gatewayServerRoutes.delete(gatewayId);
    this._gatewayToClient.delete(gatewayId);
    this._gatewayDisposables.get(gatewayId)?.dispose();
    this._gatewayDisposables.delete(gatewayId);
  }
  _createRouteForServer(gatewayId, serverId, label, toolInvoker, routeIds, serverRouteMap) {
    const routeId = generateUuid();
    const singleServerInvoker = {
      onDidChangeTools: toolInvoker.onDidChangeTools,
      onDidChangeResources: toolInvoker.onDidChangeResources,
      listTools: () => toolInvoker.listToolsForServer(serverId),
      callTool: (name, args) => toolInvoker.callToolForServer(serverId, name, args),
      listResources: () => toolInvoker.listResourcesForServer(serverId),
      readResource: (uri) => toolInvoker.readResourceForServer(serverId, uri),
      listResourceTemplates: () => toolInvoker.listResourceTemplatesForServer(serverId)
    };
    const route = new McpGatewayRoute(routeId, this._logger, singleServerInvoker, label);
    this._routes.set(routeId, route);
    routeIds.add(routeId);
    serverRouteMap.set(serverId, routeId);
    const address = URI.parse(`http://127.0.0.1:${this._port}/gateway/${routeId}`);
    this._logger.info(`[McpGatewayService] Created route ${routeId} for server '${label}' (${serverId}) at ${address}`);
    return { label, address };
  }
  _getGatewayServers(gatewayId) {
    const serverRouteMap = this._gatewayServerRoutes.get(gatewayId);
    if (!serverRouteMap) {
      return [];
    }
    const servers = [];
    for (const [_serverId, routeId] of serverRouteMap) {
      const route = this._routes.get(routeId);
      if (route) {
        servers.push({
          label: route.label,
          address: URI.parse(`http://127.0.0.1:${this._port}/gateway/${routeId}`)
        });
      }
    }
    return servers;
  }
  _disposeRoute(routeId) {
    const route = this._routes.get(routeId);
    if (route) {
      route.dispose();
      this._routes.delete(routeId);
      this._logger.info(`[McpGatewayService] Disposed route: ${routeId}`);
    }
  }
  async disposeGateway(gatewayId) {
    if (!this._gatewayRoutes.has(gatewayId)) {
      this._logger.warn(`[McpGatewayService] Attempted to dispose unknown gateway: ${gatewayId}`);
      return;
    }
    this._cleanupGateway(gatewayId);
    this._logger.info(`[McpGatewayService] Disposed gateway: ${gatewayId} (remaining routes: ${this._routes.size})`);
    if (this._routes.size === 0) {
      this._stopServer();
    }
  }
  disposeGatewaysForClient(clientId) {
    const gatewaysToDispose = [];
    for (const [gatewayId, ownerClientId] of this._gatewayToClient) {
      if (ownerClientId === clientId) {
        gatewaysToDispose.push(gatewayId);
      }
    }
    if (gatewaysToDispose.length > 0) {
      this._logger.info(`[McpGatewayService] Disposing ${gatewaysToDispose.length} gateway(s) for disconnected client ${clientId}`);
      for (const gatewayId of gatewaysToDispose) {
        this._cleanupGateway(gatewayId);
      }
      if (this._routes.size === 0) {
        this._stopServer();
      }
    }
  }
  async _ensureServer() {
    if (this._server?.listening) {
      return;
    }
    if (this._serverStartPromise) {
      return this._serverStartPromise;
    }
    this._serverStartPromise = this._startServer();
    try {
      await this._serverStartPromise;
    } finally {
      this._serverStartPromise = void 0;
    }
  }
  async _startServer() {
    const { createServer } = await import("http");
    const deferredPromise = new DeferredPromise();
    this._server = createServer((req, res) => {
      this._handleRequest(req, res);
    });
    const portTimeout = setTimeout(() => {
      deferredPromise.error(new Error("[McpGatewayService] Timeout waiting for server to start"));
    }, 5e3);
    this._server.on("listening", () => {
      const address = this._server.address();
      if (typeof address === "string") {
        this._port = parseInt(address);
      } else if (address instanceof Object) {
        this._port = address.port;
      } else {
        clearTimeout(portTimeout);
        deferredPromise.error(new Error("[McpGatewayService] Unable to determine port"));
        return;
      }
      clearTimeout(portTimeout);
      this._logger.info(`[McpGatewayService] Server started on port ${this._port}`);
      deferredPromise.complete();
    });
    this._server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        this._logger.warn("[McpGatewayService] Port in use, retrying with random port...");
        this._server.listen(0, "127.0.0.1");
        return;
      }
      clearTimeout(portTimeout);
      this._logger.error(`[McpGatewayService] Server error: ${err}`);
      deferredPromise.error(err);
    });
    this._server.listen(0, "127.0.0.1");
    return deferredPromise.p;
  }
  _stopServer() {
    if (!this._server) {
      return;
    }
    this._logger.info("[McpGatewayService] Stopping server (no more routes)");
    this._server.close((err) => {
      if (err) {
        this._logger.error(`[McpGatewayService] Error closing server: ${err}`);
      } else {
        this._logger.info("[McpGatewayService] Server stopped");
      }
    });
    this._server = void 0;
    this._port = void 0;
  }
  _handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split("/").filter(Boolean);
    this._logger.debug(`[McpGatewayService] ${req.method} ${url.pathname} (active routes: ${this._routes.size})`);
    if (pathParts.length >= 2 && pathParts[0] === "gateway") {
      const routeId = pathParts[1];
      const route = this._routes.get(routeId);
      if (route) {
        route.handleRequest(req, res);
        return;
      }
    }
    this._logger.warn(`[McpGatewayService] ${req.method} ${url.pathname}: route not found`);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Gateway not found" }));
  }
  dispose() {
    this._logger.info(`[McpGatewayService] Disposing service (routes: ${this._routes.size})`);
    this._stopServer();
    for (const route of this._routes.values()) {
      route.dispose();
    }
    this._routes.clear();
    this._gatewayRoutes.clear();
    this._gatewayServerRoutes.clear();
    this._gatewayToClient.clear();
    for (const disposables of this._gatewayDisposables.values()) {
      disposables.dispose();
    }
    this._gatewayDisposables.clear();
    super.dispose();
  }
};
McpGatewayService = __decorateClass([
  __decorateParam(0, ILoggerService)
], McpGatewayService);
class McpGatewayRoute extends Disposable {
  constructor(routeId, _logger, _serverInvoker, label = "") {
    super();
    this.routeId = routeId;
    this._logger = _logger;
    this._serverInvoker = _serverInvoker;
    this.label = label;
    this._sessions = /* @__PURE__ */ new Map();
  }
  static {
    this.SessionHeaderName = "mcp-session-id";
  }
  handleRequest(req, res) {
    this._logger.debug(`[McpGateway][route ${this.routeId}] ${req.method} request (sessions: ${this._sessions.size})`);
    if (req.method === "POST") {
      void this._handlePost(req, res);
      return;
    }
    if (req.method === "GET") {
      this._handleGet(req, res);
      return;
    }
    if (req.method === "DELETE") {
      this._handleDelete(req, res);
      return;
    }
    this._respondHttpError(res, 405, "Method not allowed");
  }
  dispose() {
    this._logger.info(`[McpGateway][route ${this.routeId}] Disposing route (sessions: ${this._sessions.size})`);
    for (const session of this._sessions.values()) {
      session.dispose();
    }
    this._sessions.clear();
    super.dispose();
  }
  _handleDelete(req, res) {
    const sessionId = this._getSessionId(req);
    if (!sessionId) {
      this._respondHttpError(res, 400, "Missing Mcp-Session-Id header");
      return;
    }
    const session = this._sessions.get(sessionId);
    if (!session) {
      this._respondHttpError(res, 404, "Session not found");
      return;
    }
    this._logger.info(`[McpGateway][route ${this.routeId}] Deleting session ${sessionId}`);
    session.dispose();
    this._sessions.delete(sessionId);
    res.writeHead(204);
    res.end();
  }
  _handleGet(req, res) {
    const sessionId = this._getSessionId(req);
    if (!sessionId) {
      this._respondHttpError(res, 400, "Missing Mcp-Session-Id header");
      return;
    }
    const session = this._sessions.get(sessionId);
    if (!session) {
      this._respondHttpError(res, 404, "Session not found");
      return;
    }
    this._logger.info(`[McpGateway][route ${this.routeId}] SSE connection requested for session ${sessionId}`);
    session.attachSseClient(req, res);
  }
  async _handlePost(req, res) {
    const body = await this._readRequestBody(req);
    if (body === void 0) {
      this._respondHttpError(res, 413, "Payload too large");
      return;
    }
    this._logger.debug(`[McpGateway][route ${this.routeId}] Handling POST`);
    let message;
    try {
      message = JSON.parse(body);
    } catch (error) {
      this._logger.warn(`[McpGateway][route ${this.routeId}] JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(JsonRpcProtocol.createParseError("Parse error", error instanceof Error ? error.message : String(error))));
      return;
    }
    const headerSessionId = this._getSessionId(req);
    const session = this._resolveSessionForPost(headerSessionId, message, res);
    if (!session) {
      return;
    }
    try {
      const responses = await session.handleIncoming(message);
      const headers = {
        "Content-Type": "application/json",
        "Mcp-Session-Id": session.id
      };
      if (responses.length === 0) {
        this._logger.debug(`[McpGateway][route ${this.routeId}] POST response: 202 (no content)`);
        res.writeHead(202, headers);
        res.end();
        return;
      }
      const responseBody = JSON.stringify(Array.isArray(message) ? responses : responses[0]);
      this._logger.debug(`[McpGateway][route ${this.routeId}] POST response: 200, body: ${responseBody}`);
      res.writeHead(200, headers);
      res.end(responseBody);
    } catch (error) {
      this._logger.error("[McpGatewayService] Failed handling gateway request", error);
      this._respondHttpError(res, 500, "Internal server error");
    }
  }
  _resolveSessionForPost(headerSessionId, message, res) {
    if (headerSessionId) {
      const existing = this._sessions.get(headerSessionId);
      if (!existing) {
        this._logger.warn(`[McpGateway][route ${this.routeId}] Session not found: ${headerSessionId}`);
        this._respondHttpError(res, 404, "Session not found");
        return void 0;
      }
      return existing;
    }
    if (!isInitializeMessage(message)) {
      this._respondHttpError(res, 400, "Missing Mcp-Session-Id header");
      return void 0;
    }
    const sessionId = generateUuid();
    this._logger.info(`[McpGateway][route ${this.routeId}] Creating new session ${sessionId}`);
    const session = new McpGatewaySession(sessionId, this._logger, () => {
      this._sessions.delete(sessionId);
    }, this._serverInvoker);
    this._sessions.set(sessionId, session);
    return session;
  }
  _respondHttpError(res, statusCode, error) {
    this._logger.debug(`[McpGateway][route ${this.routeId}] HTTP error response: ${statusCode} ${error}`);
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: statusCode, message: error } }));
  }
  _getSessionId(req) {
    const value = req.headers[McpGatewayRoute.SessionHeaderName];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
  async _readRequestBody(req) {
    const chunks = [];
    let size = 0;
    const maxBytes = 1024 * 1024;
    for await (const chunk of req) {
      const asBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += asBuffer.byteLength;
      if (size > maxBytes) {
        return void 0;
      }
      chunks.push(asBuffer);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
}
export {
  McpGatewayService
};
