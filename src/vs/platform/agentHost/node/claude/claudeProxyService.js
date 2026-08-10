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
import { once } from "events";
import { Emitter } from "../../../../base/common/event.js";
import { createDecorator } from "../../../instantiation/common/instantiation.js";
import { ILogService } from "../../../log/common/log.js";
import {
  COPILOT_API_ERROR_STATUS_STREAMING,
  CopilotApiError,
  ICopilotApiService
} from "../shared/copilotApiService.js";
import { buildForwardedChatError, encodeForwardedChatError } from "../shared/proxyChatError.js";
import {
  LoopbackProxyServer,
  readProxyRequestBody
} from "../shared/loopbackProxyServer.js";
import { filterSupportedBetas } from "./anthropicBetas.js";
import {
  buildErrorEnvelope,
  formatSseErrorFrame,
  writeJsonError,
  writeUpstreamJsonError
} from "./anthropicErrors.js";
import { tryParseClaudeModelId } from "./claudeModelId.js";
import { parseProxyBearer } from "./claudeProxyAuth.js";
const IClaudeProxyService = createDecorator("claudeProxyService");
const KNOWN_CLAUDE_VENDORS = /* @__PURE__ */ new Set(["anthropic"]);
const ANTHROPIC_MESSAGES_ENDPOINT = "/v1/messages";
const PROXY_USER_FACING_NAME = "ClaudeProxyService";
const USER_AGENT_PREFIX = "vscode_claude_code";
function readCopilotUsageNanoAiu(event) {
  const value = event?.copilot_usage?.total_nano_aiu;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
let ClaudeProxyService = class extends LoopbackProxyServer {
  constructor(logService, _copilotApiService) {
    super(PROXY_USER_FACING_NAME, logService);
    this._copilotApiService = _copilotApiService;
    this._onDidReportCredits = new Emitter();
    this.onDidReportCredits = this._onDidReportCredits.event;
  }
  createState(githubToken) {
    return { githubToken };
  }
  async start(githubToken) {
    const { runtime, release } = await this.acquire(githubToken);
    runtime.state.githubToken = githubToken;
    return {
      baseUrl: runtime.baseUrl,
      nonce: runtime.nonce,
      dispose: release
    };
  }
  dispose() {
    super.dispose();
    this._onDidReportCredits.dispose();
  }
  writeInternalError(res) {
    writeJsonError(res, 500, "api_error", "Internal proxy error");
  }
  /**
   * Fire {@link onDidReportCredits} for a completed request. No-op when
   * the request carried no credits (`copilot_usage` absent) or the
   * Bearer token lacked a session id (shouldn't happen post-auth).
   */
  _reportCredits(sessionId, totalNanoAiu) {
    if (sessionId === void 0 || totalNanoAiu === void 0) {
      return;
    }
    this._logService.trace(`[${PROXY_USER_FACING_NAME}] credits: session=${sessionId} totalNanoAiu=${totalNanoAiu}`);
    this._onDidReportCredits.fire({ sessionId, totalNanoAiu });
  }
  // #region Dispatch
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
    if (!auth.valid) {
      writeJsonError(res, 401, "authentication_error", "Invalid authentication");
      return;
    }
    if (method === "GET" && pathname === "/v1/models") {
      await this._handleModels(req, res, runtime);
      return;
    }
    if (method === "POST" && pathname === "/v1/messages") {
      await this._handleMessages(req, res, runtime, auth.sessionId);
      return;
    }
    if (method === "POST" && pathname === "/v1/messages/count_tokens") {
      writeJsonError(res, 501, "api_error", "count_tokens not supported by CAPI");
      return;
    }
    writeJsonError(res, 404, "not_found_error", `No route for ${method} ${pathname}`);
  }
  // #endregion
  // #region GET /v1/models
  async _handleModels(req, res, runtime) {
    const headers = buildOutboundHeaders(req.headers);
    let models;
    try {
      models = await this._copilotApiService.models(runtime.state.githubToken, { headers, suppressIntegrationId: true });
    } catch (err) {
      this._writeUpstreamErrorResponse(res, err);
      return;
    }
    const data = [];
    for (const m of models) {
      if (!isAnthropicMessagesModel(m)) {
        continue;
      }
      const parsed = tryParseClaudeModelId(m.id);
      const sdkId = parsed ? parsed.toSdkModelId() : m.id;
      data.push({
        id: sdkId,
        type: "model",
        display_name: m.name || sdkId,
        created_at: "1970-01-01T00:00:00Z",
        capabilities: null,
        max_input_tokens: null,
        max_tokens: null
      });
    }
    const body = {
      data,
      has_more: false,
      first_id: data.length > 0 ? data[0].id : null,
      last_id: data.length > 0 ? data[data.length - 1].id : null
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }
  // #endregion
  // #region POST /v1/messages
  async _handleMessages(req, res, runtime, sessionId) {
    let bodyString;
    try {
      bodyString = await readProxyRequestBody(req);
    } catch (err) {
      writeJsonError(res, 400, "invalid_request_error", `Failed to read request body: ${stringifyError(err)}`);
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(bodyString);
    } catch {
      writeJsonError(res, 400, "invalid_request_error", "Request body is not valid JSON");
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      writeJsonError(res, 400, "invalid_request_error", "Request body must be a JSON object");
      return;
    }
    const body = parsed;
    const sdkModelId = body.model;
    if (typeof sdkModelId !== "string" || sdkModelId.length === 0) {
      writeJsonError(res, 400, "invalid_request_error", "Missing required field: model");
      return;
    }
    if (!Array.isArray(body.messages)) {
      writeJsonError(res, 400, "invalid_request_error", "Missing required field: messages");
      return;
    }
    const parsedModel = tryParseClaudeModelId(sdkModelId);
    if (!parsedModel) {
      writeJsonError(res, 404, "not_found_error", `Unknown model: ${sdkModelId}`);
      return;
    }
    const endpointModelId = parsedModel.toEndpointModelId();
    body.model = endpointModelId;
    const stream = body.stream === true;
    const headers = buildOutboundHeaders(req.headers);
    const entry = {
      ac: new AbortController(),
      res,
      clientGone: false
    };
    runtime.inFlight.add(entry);
    const onClose = () => {
      entry.clientGone = true;
      entry.ac.abort();
    };
    res.on("close", onClose);
    try {
      if (stream) {
        await this._streamMessages(
          body,
          headers,
          res,
          entry,
          runtime,
          sdkModelId,
          sessionId
        );
      } else {
        await this._sendNonStreamingMessage(
          body,
          headers,
          res,
          entry,
          runtime,
          sdkModelId,
          sessionId
        );
      }
    } finally {
      res.removeListener("close", onClose);
      runtime.inFlight.delete(entry);
    }
  }
  async _sendNonStreamingMessage(body, headers, res, entry, runtime, originalSdkModelId, sessionId) {
    const options = { headers, signal: entry.ac.signal, suppressIntegrationId: true };
    let message;
    try {
      message = await this._copilotApiService.messages(runtime.state.githubToken, body, options);
    } catch (err) {
      if (entry.ac.signal.aborted) {
        if (!entry.clientGone && !res.writableEnded) {
          res.destroy();
        }
        return;
      }
      this._writeUpstreamErrorResponse(res, err, true);
      return;
    }
    this._reportCredits(sessionId, readCopilotUsageNanoAiu(message));
    const outboundModel = rewriteModelToSdk(message.model, this._logService) ?? originalSdkModelId;
    const responseBody = { ...message, model: outboundModel };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responseBody));
  }
  async _streamMessages(body, headers, res, entry, runtime, _originalSdkModelId, sessionId) {
    const options = { headers, signal: entry.ac.signal, suppressIntegrationId: true };
    let stream;
    try {
      stream = this._copilotApiService.messages(runtime.state.githubToken, body, options);
    } catch (err) {
      if (entry.ac.signal.aborted) {
        if (!entry.clientGone && !res.writableEnded) {
          res.destroy();
        }
        return;
      }
      this._writeUpstreamErrorResponse(res, err, true);
      return;
    }
    let first;
    try {
      first = await stream.next();
    } catch (err) {
      if (entry.ac.signal.aborted) {
        if (!entry.clientGone && !res.writableEnded) {
          res.destroy();
        }
        return;
      }
      this._writeUpstreamErrorResponse(res, err, true);
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    res.flushHeaders();
    req_setNoDelay(res);
    const writeFrame = async (event) => {
      const transformed = rewriteEventModel(event, this._logService);
      const frame = `event: ${transformed.type}
data: ${JSON.stringify(transformed)}

`;
      const ok = res.write(frame);
      if (!ok) {
        try {
          await once(res, "drain", { signal: entry.ac.signal });
        } catch {
          return false;
        }
      }
      return true;
    };
    let reportedNanoAiu;
    try {
      if (!first.done) {
        reportedNanoAiu = readCopilotUsageNanoAiu(first.value) ?? reportedNanoAiu;
        const ok = await writeFrame(first.value);
        if (!ok) {
          return;
        }
      }
      while (true) {
        let next;
        try {
          next = await stream.next();
        } catch (err) {
          if (entry.ac.signal.aborted) {
            if (!entry.clientGone && !res.writableEnded) {
              res.destroy();
            }
            return;
          }
          const envelope = err instanceof CopilotApiError ? embedForwardedChatError(err) : buildErrorEnvelope("api_error", stringifyError(err));
          if (!res.writableEnded) {
            try {
              res.write(formatSseErrorFrame(envelope));
            } catch {
            }
            try {
              res.end();
            } catch {
            }
          }
          return;
        }
        if (next.done) {
          break;
        }
        reportedNanoAiu = readCopilotUsageNanoAiu(next.value) ?? reportedNanoAiu;
        const ok = await writeFrame(next.value);
        if (!ok) {
          return;
        }
      }
      if (!res.writableEnded) {
        res.end();
      }
      this._reportCredits(sessionId, reportedNanoAiu);
    } catch (err) {
      this._logService.warn(`[${PROXY_USER_FACING_NAME}] stream loop unexpected error: ${stringifyError(err)}`);
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {
        }
      }
    }
  }
  // #endregion
  // #region Error helpers
  /**
   * Writes an upstream error as a JSON response. When `embedChatError` is set
   * (the `/v1/messages` paths), a `VSCODE_PROXY_ERROR` marker is appended to
   * the envelope message so the structured CAPI error round-trips back through
   * the SDK subprocess to the agent host (which decodes it into `_meta` and
   * strips the marker). The `/v1/models` path does not round-trip, so it
   * re-emits the envelope verbatim.
   */
  _writeUpstreamErrorResponse(res, err, embedChatError = false) {
    if (res.headersSent) {
      this._logService.warn(`[${PROXY_USER_FACING_NAME}] cannot write upstream error after headers sent: ${stringifyError(err)}`);
      if (!res.writableEnded) {
        try {
          res.end();
        } catch {
        }
      }
      return;
    }
    if (err instanceof CopilotApiError) {
      const status = err.status === COPILOT_API_ERROR_STATUS_STREAMING ? 502 : err.status;
      writeUpstreamJsonError(res, status, embedChatError ? embedForwardedChatError(err) : err.envelope);
      return;
    }
    writeJsonError(res, 502, "api_error", err instanceof Error ? err.message : String(err));
  }
  // #endregion
};
ClaudeProxyService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ICopilotApiService)
], ClaudeProxyService);
function isAnthropicMessagesModel(m) {
  if (!KNOWN_CLAUDE_VENDORS.has(m.vendor.toLowerCase())) {
    return false;
  }
  return Array.isArray(m.supported_endpoints) && m.supported_endpoints.includes(ANTHROPIC_MESSAGES_ENDPOINT);
}
function rewriteModelToSdk(modelId, logService) {
  const parsed = tryParseClaudeModelId(modelId);
  if (!parsed) {
    logService.warn(`[${PROXY_USER_FACING_NAME}] outbound model ID could not be parsed for SDK rewrite: ${modelId}`);
    return void 0;
  }
  return parsed.toSdkModelId();
}
function rewriteEventModel(event, logService) {
  if (event.type !== "message_start") {
    return event;
  }
  const sdkModel = rewriteModelToSdk(event.message.model, logService);
  if (sdkModel === void 0 || sdkModel === event.message.model) {
    return event;
  }
  return {
    ...event,
    message: { ...event.message, model: sdkModel }
  };
}
function buildOutboundHeaders(inbound) {
  const out = {};
  const version = inbound["anthropic-version"];
  if (typeof version === "string" && version.length > 0) {
    out["anthropic-version"] = version;
  }
  const beta = inbound["anthropic-beta"];
  if (typeof beta === "string" && beta.length > 0) {
    const filtered = filterSupportedBetas(beta);
    if (filtered !== void 0) {
      out["anthropic-beta"] = filtered;
    }
  }
  const userAgent = inbound["user-agent"];
  if (typeof userAgent === "string" && userAgent.length > 0) {
    out["User-Agent"] = transformUserAgent(userAgent);
  }
  return out;
}
function transformUserAgent(userAgent) {
  const slashIndex = userAgent.indexOf("/");
  if (slashIndex === -1) {
    return `${USER_AGENT_PREFIX}/${userAgent}`;
  }
  return `${USER_AGENT_PREFIX}${userAgent.substring(slashIndex)}`;
}
function req_setNoDelay(res) {
  const socket = res.socket;
  if (socket && typeof socket.setNoDelay === "function") {
    try {
      socket.setNoDelay(true);
    } catch {
    }
  }
}
function stringifyError(err) {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
function embedForwardedChatError(err) {
  const marker = encodeForwardedChatError(buildForwardedChatError(err));
  return {
    ...err.envelope,
    error: {
      ...err.envelope.error,
      message: `${err.envelope.error.message} ${marker}`
    }
  };
}
export {
  ClaudeProxyService,
  IClaudeProxyService
};
