import {
  isJsonRpcNotification,
  isJsonRpcResponse,
  JsonRpcError,
  JsonRpcProtocol
} from "../../../base/common/jsonRpcProtocol.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { hasKey } from "../../../base/common/types.js";
const MCP_LATEST_PROTOCOL_VERSION = "2025-11-25";
const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07"
];
const MCP_INVALID_REQUEST = -32600;
const MCP_METHOD_NOT_FOUND = -32601;
const MCP_INVALID_PARAMS = -32602;
class McpGatewaySession extends Disposable {
  constructor(id, _logService, _onDidDispose, _serverInvoker) {
    super();
    this.id = id;
    this._logService = _logService;
    this._onDidDispose = _onDidDispose;
    this._serverInvoker = _serverInvoker;
    this._sseClients = /* @__PURE__ */ new Set();
    this._lastEventId = 0;
    this._isInitialized = false;
    this._rpc = this._register(new JsonRpcProtocol(
      (message) => this._handleOutgoingMessage(message),
      {
        handleRequest: (request) => this._handleRequest(request),
        handleNotification: (notification) => this._handleNotification(notification)
      }
    ));
    this._register(this._serverInvoker.onDidChangeTools(() => {
      if (!this._isInitialized) {
        return;
      }
      this._logService.info(`[McpGateway][session ${this.id}] Tools changed, notifying client`);
      this._rpc.sendNotification({ method: "notifications/tools/list_changed" });
    }));
    this._register(this._serverInvoker.onDidChangeResources(() => {
      if (!this._isInitialized) {
        return;
      }
      this._logService.info(`[McpGateway][session ${this.id}] Resources changed, notifying client`);
      this._rpc.sendNotification({ method: "notifications/resources/list_changed" });
    }));
  }
  attachSseClient(_req, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    });
    res.write(": connected\n\n");
    this._sseClients.add(res);
    this._logService.info(`[McpGateway][session ${this.id}] SSE client attached (total: ${this._sseClients.size})`);
    res.on("close", () => {
      this._sseClients.delete(res);
      this._logService.info(`[McpGateway][session ${this.id}] SSE client detached (total: ${this._sseClients.size})`);
    });
  }
  async handleIncoming(message) {
    return this._rpc.handleMessage(message);
  }
  dispose() {
    this._logService.info(`[McpGateway][session ${this.id}] Disposing session (SSE clients: ${this._sseClients.size})`);
    for (const client of this._sseClients) {
      if (!client.destroyed) {
        client.end();
      }
    }
    this._sseClients.clear();
    this._onDidDispose();
    super.dispose();
  }
  _handleOutgoingMessage(message) {
    if (isJsonRpcResponse(message)) {
      this._logService.debug(`[McpGateway][session ${this.id}] --> response: ${JSON.stringify(message)}`);
      return;
    }
    if (isJsonRpcNotification(message)) {
      this._logService.debug(`[McpGateway][session ${this.id}] --> notification: ${message.method}`);
      this._broadcastSse(message);
      return;
    }
    this._logService.warn("[McpGatewayService] Ignored unsupported outgoing gateway message");
  }
  _broadcastSse(message) {
    if (this._sseClients.size === 0) {
      this._logService.debug(`[McpGateway][session ${this.id}] No SSE clients to broadcast to, dropping message`);
      return;
    }
    const payload = JSON.stringify(message);
    const eventId = String(++this._lastEventId);
    this._logService.debug(`[McpGateway][session ${this.id}] Broadcasting SSE event id=${eventId} to ${this._sseClients.size}`);
    const lines = payload.split(/\r?\n/g);
    const data = [
      `id: ${eventId}`,
      "event: message",
      ...lines.map((line) => `data: ${line}`),
      "",
      ""
    ].join("\n");
    for (const client of [...this._sseClients]) {
      if (client.destroyed || client.writableEnded) {
        this._sseClients.delete(client);
        continue;
      }
      client.write(data);
    }
  }
  async _handleRequest(request) {
    this._logService.debug(`[McpGateway][session ${this.id}] <-- request: ${request.method} (id=${String(request.id)})`);
    if (request.method === "initialize") {
      return this._handleInitialize(request);
    }
    if (!this._isInitialized) {
      this._logService.warn(`[McpGateway][session ${this.id}] Rejected request '${request.method}': session not initialized`);
      throw new JsonRpcError(MCP_INVALID_REQUEST, "Session is not initialized");
    }
    switch (request.method) {
      case "ping":
        return {};
      case "tools/list":
        return this._handleListTools();
      case "tools/call":
        return this._handleCallTool(request);
      case "resources/list":
        return this._handleListResources();
      case "resources/read":
        return this._handleReadResource(request);
      case "resources/templates/list":
        return this._handleListResourceTemplates();
      default:
        this._logService.warn(`[McpGateway][session ${this.id}] Unknown method: ${request.method}`);
        throw new JsonRpcError(MCP_METHOD_NOT_FOUND, `Method not found: ${request.method}`);
    }
  }
  _handleNotification(notification) {
    this._logService.debug(`[McpGateway][session ${this.id}] <-- notification: ${notification.method}`);
    if (notification.method === "notifications/initialized") {
      this._isInitialized = true;
      this._logService.info(`[McpGateway][session ${this.id}] Session initialized`);
      this._rpc.sendNotification({ method: "notifications/tools/list_changed" });
      this._rpc.sendNotification({ method: "notifications/resources/list_changed" });
    }
  }
  _handleInitialize(request) {
    const params = typeof request.params === "object" && request.params ? request.params : void 0;
    const clientVersion = typeof params?.protocolVersion === "string" ? params.protocolVersion : void 0;
    const clientInfo = params?.clientInfo;
    const negotiatedVersion = clientVersion && MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(clientVersion) ? clientVersion : MCP_LATEST_PROTOCOL_VERSION;
    this._logService.info(`[McpGateway] Initialize: client=${clientInfo?.name ?? "unknown"}/${clientInfo?.version ?? "?"}, clientProtocol=${clientVersion ?? "(none)"}, negotiated=${negotiatedVersion}`);
    if (clientVersion && clientVersion !== negotiatedVersion) {
      this._logService.warn(`[McpGateway] Client requested unsupported protocol version '${clientVersion}', falling back to '${negotiatedVersion}'`);
    }
    return {
      protocolVersion: negotiatedVersion,
      capabilities: {
        tools: {
          listChanged: true
        },
        resources: {
          listChanged: true
        }
      },
      serverInfo: {
        name: "VS Code MCP Gateway",
        version: "1.0.0"
      }
    };
  }
  async _handleCallTool(request) {
    const params = typeof request.params === "object" && request.params ? request.params : void 0;
    if (!params || typeof params.name !== "string") {
      throw new JsonRpcError(MCP_INVALID_PARAMS, "Missing tool call params");
    }
    if (params.arguments && typeof params.arguments !== "object") {
      throw new JsonRpcError(MCP_INVALID_PARAMS, "Invalid tool call arguments");
    }
    const argumentsValue = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
    this._logService.debug(`[McpGateway][session ${this.id}] Calling tool '${params.name}' with args: ${JSON.stringify(argumentsValue)}`);
    try {
      const result = await this._serverInvoker.callTool(params.name, argumentsValue);
      this._logService.debug(`[McpGateway][session ${this.id}] Tool '${params.name}' completed (isError=${result.isError ?? false}, content blocks=${result.content.length})`);
      return result;
    } catch (error) {
      this._logService.error(`[McpGateway][session ${this.id}] Tool '${params.name}' invocation failed`, error);
      throw new JsonRpcError(MCP_INVALID_PARAMS, String(error));
    }
  }
  async _handleListTools() {
    const tools = await this._serverInvoker.listTools();
    this._logService.debug(`[McpGateway][session ${this.id}] Listed ${tools.length} tool(s): [${tools.map((t) => t.name).join(", ")}]`);
    return { tools };
  }
  async _handleListResources() {
    const resources = await this._serverInvoker.listResources();
    this._logService.debug(`[McpGateway][session ${this.id}] Listed ${resources.length} resource(s)`);
    return { resources };
  }
  async _handleReadResource(request) {
    const params = typeof request.params === "object" && request.params ? request.params : void 0;
    if (!params || typeof params.uri !== "string") {
      throw new JsonRpcError(MCP_INVALID_PARAMS, "Missing resource URI");
    }
    this._logService.debug(`[McpGateway][session ${this.id}] Reading resource '${params.uri}'`);
    try {
      const result = await this._serverInvoker.readResource(params.uri);
      this._logService.debug(`[McpGateway][session ${this.id}] Resource read returned ${result.contents.length} content(s)`);
      return result;
    } catch (error) {
      this._logService.error(`[McpGateway][session ${this.id}] Resource read failed for '${params.uri}'`, error);
      throw new JsonRpcError(MCP_INVALID_PARAMS, String(error));
    }
  }
  async _handleListResourceTemplates() {
    const resourceTemplates = await this._serverInvoker.listResourceTemplates();
    this._logService.debug(`[McpGateway][session ${this.id}] Listed ${resourceTemplates.length} resource template(s)`);
    return { resourceTemplates };
  }
}
function isInitializeMessage(message) {
  const first = Array.isArray(message) ? message[0] : message;
  if (!first || !hasKey(first, { method: true })) {
    return false;
  }
  return first.method === "initialize";
}
export {
  McpGatewaySession,
  isInitializeMessage
};
