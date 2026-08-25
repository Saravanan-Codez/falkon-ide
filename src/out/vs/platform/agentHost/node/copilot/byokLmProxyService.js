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
import { createDecorator } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import { IByokLmBridgeRegistry } from "../byokLmBridgeRegistry.js";
import { parseProxyBearer } from "../claude/claudeProxyAuth.js";
import {
  LoopbackProxyServer,
  readProxyRequestBody
} from "../shared/loopbackProxyServer.js";
import {
  bridgeResultToResponsesBody,
  bridgeResultToResponsesSseFrames,
  responsesErrorBody,
  responsesRequestToBridge,
  ResponsesTranslationError
} from "./byokResponsesTranslation.js";
const IByokLmProxyService = createDecorator("byokLmProxyService");
const PROXY_USER_FACING_NAME = "ByokLmProxyService";
const VENDOR_PATH_PREFIX = "/v/";
const RESPONSES_SUFFIX = "/responses";
let ByokLmProxyService = class extends LoopbackProxyServer {
  constructor(logService, _bridgeRegistry) {
    super(PROXY_USER_FACING_NAME, logService);
    this._bridgeRegistry = _bridgeRegistry;
  }
  createState() {
    return void 0;
  }
  async start() {
    const { runtime, release } = await this.acquire();
    let disposed = false;
    return {
      baseUrl: runtime.baseUrl,
      nonce: runtime.nonce,
      providerBaseUrl: (vendor) => `${runtime.baseUrl}${VENDOR_PATH_PREFIX}${encodeURIComponent(vendor)}`,
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        release();
      }
    };
  }
  /** Emit the base's fallback failure using the OpenAI error envelope. */
  writeInternalError(res) {
    this._writeJsonError(res, 500, "Internal proxy error");
  }
  async handleRequest(req, res, runtime) {
    const method = req.method ?? "GET";
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    this._logService.trace(`[${PROXY_USER_FACING_NAME}] ${method} ${pathname}`);
    if (method === "GET" && pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    const auth = parseProxyBearer(req.headers, runtime.nonce);
    if (!auth.valid || !auth.sessionId) {
      this._writeJsonError(res, 401, "Invalid authentication", "authentication_error");
      return;
    }
    const vendor = this._parseVendorFromResponsesPath(pathname);
    if (method === "POST" && vendor !== void 0) {
      await this._handleResponses(req, res, runtime, vendor);
      return;
    }
    this._writeJsonError(res, 404, `No route for ${method} ${pathname}`, "not_found_error");
  }
  /**
   * Extract the vendor from a `/v/<vendor>/responses` path.
   */
  _parseVendorFromResponsesPath(pathname) {
    if (!pathname.startsWith(VENDOR_PATH_PREFIX) || !pathname.endsWith(RESPONSES_SUFFIX)) {
      return void 0;
    }
    const vendorSegment = pathname.slice(VENDOR_PATH_PREFIX.length, pathname.length - RESPONSES_SUFFIX.length);
    if (!vendorSegment) {
      return void 0;
    }
    let vendor;
    try {
      vendor = decodeURIComponent(vendorSegment);
    } catch {
      return void 0;
    }
    if (!vendor || vendor.includes("/")) {
      return void 0;
    }
    return vendor;
  }
  async _handleResponses(req, res, runtime, vendor) {
    let body;
    try {
      const raw = await readProxyRequestBody(req);
      body = JSON.parse(raw);
    } catch (err) {
      this._writeJsonError(res, 400, `Invalid request body: ${err instanceof Error ? err.message : String(err)}`, "invalid_request_error");
      return;
    }
    let bridgeRequest;
    try {
      bridgeRequest = responsesRequestToBridge(vendor, body);
    } catch (err) {
      const message = err instanceof ResponsesTranslationError ? err.message : String(err);
      this._writeJsonError(res, 400, message, "invalid_request_error");
      return;
    }
    const connection = this._bridgeRegistry.getServingConnection();
    if (!connection) {
      this._writeJsonError(res, 503, "No renderer connection available to service BYOK models", "api_error");
      return;
    }
    const entry = { ac: new AbortController(), res, clientGone: false };
    runtime.inFlight.add(entry);
    const onClose = () => {
      entry.clientGone = true;
      entry.ac.abort();
    };
    res.on("close", onClose);
    try {
      const result = await connection.chat(bridgeRequest);
      if (entry.ac.signal.aborted || res.writableEnded) {
        return;
      }
      if (result.error) {
        this._writeJsonError(res, 502, result.error, "api_error");
        return;
      }
      if (body.stream === true) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });
        for (const frame of bridgeResultToResponsesSseFrames(result, bridgeRequest.modelId)) {
          res.write(frame);
        }
        res.end();
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(bridgeResultToResponsesBody(result, bridgeRequest.modelId));
      }
    } catch (err) {
      if (entry.ac.signal.aborted || res.writableEnded) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) {
        this._writeJsonError(res, 502, message, "api_error");
      } else {
        try {
          res.end();
        } catch {
        }
      }
    } finally {
      res.removeListener("close", onClose);
      runtime.inFlight.delete(entry);
    }
  }
  _writeJsonError(res, status, message, type = "api_error") {
    if (res.headersSent || res.writableEnded) {
      return;
    }
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(responsesErrorBody(message, type));
  }
};
ByokLmProxyService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IByokLmBridgeRegistry)
], ByokLmProxyService);
class NullByokLmProxyService {
  start() {
    return Promise.reject(new Error("BYOK is not supported in this agent host"));
  }
  dispose() {
  }
}
export {
  ByokLmProxyService,
  IByokLmProxyService,
  NullByokLmProxyService
};
