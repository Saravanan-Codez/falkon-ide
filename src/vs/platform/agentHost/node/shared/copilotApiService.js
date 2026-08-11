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
import { CAPIClient, RequestType } from "@vscode/copilot-api";
import { generateUuid } from "../../../../base/common/uuid.js";
import { getDevDeviceId, getMachineId } from "../../../../base/node/id.js";
import { createDecorator } from "../../../instantiation/common/instantiation.js";
import { IAgentHostGitHubEndpointService } from "../agentHostGitHubEndpointService.js";
import { ILogService } from "../../../log/common/log.js";
import { IProductService } from "../../../product/common/productService.js";
import { COPILOT_LICENSE_AGREEMENT } from "../../../endpoint/common/licenseAgreement.js";
import { parseCopilotTokenFields } from "../copilot/copilotTokenFields.js";
const COPILOT_API_ERROR_STATUS_STREAMING = 520;
const CAPI_CONTEXT_REFRESH_BUFFER_SECONDS = 5 * 60;
const CAPI_CONTEXT_TTL_SECONDS = 30 * 60;
const USER_API_VERSION = "2025-04-01";
const CAPI_URL_OVERRIDE_ENV = "VSCODE_AGENT_HOST_CAPI_URL_OVERRIDE";
const CAPI_URL_OVERRIDE_SMOKE_TEST_HOST = "vscode-smoke.test";
const CAPI_URL_OVERRIDE_SMOKE_TEST_ENV = "VSCODE_SMOKE_TEST_PROXY_HEADER";
function isLoopbackUrl(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host);
}
function isAllowedCapiUrlOverride(url) {
  if (isLoopbackUrl(url)) {
    return true;
  }
  if (!process.env[CAPI_URL_OVERRIDE_SMOKE_TEST_ENV]) {
    return false;
  }
  try {
    return new URL(url).hostname.toLowerCase() === CAPI_URL_OVERRIDE_SMOKE_TEST_HOST;
  } catch {
    return false;
  }
}
const COPILOT_TOKEN_REFRESH_BUFFER_SECONDS = 5 * 60;
const UTILITY_DEFAULT_MODEL_FAMILY = "gpt-4o-mini";
const UTILITY_DEFAULT_TEMPERATURE = 0.1;
const UTILITY_DEFAULT_TOP_P = 1;
const UTILITY_INTENT = "conversation-background";
const INTERNAL_COPILOT_ORGANIZATIONS = /* @__PURE__ */ new Set([
  "4535c7beffc844b46bb1ed4aa04d759a",
  "a5db0bcaae94032fe715fb34a5e4bce2",
  "7184f66dfcee98cb5f08a1cb936d5225",
  "1cb18ac6eedd49b43d74a1c5beb0b955",
  "ea9395b9a9248c05ee6847cbd24355ed"
]);
const VSCODE_COPILOT_ORGANIZATIONS = /* @__PURE__ */ new Set(["551cca60ce19654d894e786220822482"]);
class CopilotApiError extends Error {
  /**
   * @param status HTTP status from the originating CAPI response, or
   *   {@link COPILOT_API_ERROR_STATUS_STREAMING} for mid-stream SSE errors.
   * @param envelope Anthropic-format error envelope. For HTTP errors with a
   *   non-conforming body (plain text, malformed JSON, missing fields) this
   *   is synthesized; for conforming bodies and SSE frames it is the
   *   server's envelope verbatim.
   * @param message Optional override for `Error.message`. Defaults to
   *   `envelope.error.message`. **Never includes auth tokens.**
   */
  constructor(status, envelope, message) {
    super(message ?? envelope.error.message);
    this.status = status;
    this.envelope = envelope;
    this.name = "CopilotApiError";
  }
}
function buildCopilotApiHttpError(status, statusText, bodyText, prefix = "CAPI request failed") {
  let envelope;
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed && typeof parsed === "object" && parsed.type === "error") {
        const err = parsed.error;
        if (err && typeof err === "object" && typeof err.type === "string" && typeof err.message === "string") {
          envelope = parsed;
        }
      }
    } catch {
    }
  }
  if (!envelope) {
    envelope = {
      type: "error",
      error: {
        type: "api_error",
        message: bodyText || `${status} ${statusText}`
      },
      request_id: null
    };
  }
  return new CopilotApiError(
    status,
    envelope,
    `${prefix}: ${status} ${statusText} \u2014 ${envelope.error.message}`
  );
}
const ICopilotApiService = createDecorator("copilotApiService");
let CopilotApiService = class {
  constructor(fetchFn, _logService, _productService, _gitHubEndpointService) {
    this._logService = _logService;
    this._productService = _productService;
    this._gitHubEndpointService = _gitHubEndpointService;
    this._capiBasePromise = null;
    this._clientsByToken = /* @__PURE__ */ new Map();
    this._copilotTokensByGithub = /* @__PURE__ */ new Map();
    this._fetch = fetchFn ?? globalThis.fetch;
  }
  messages(githubToken, request, options) {
    if (request.stream) {
      return this._messagesStreaming(githubToken, request, options);
    }
    return this._messagesNonStreaming(githubToken, request, options);
  }
  async countTokens(_githubToken, _req, _options) {
    throw new Error("countTokens not supported by CAPI");
  }
  async models(githubToken, options) {
    const capiClient = await this._getClientForToken(githubToken);
    this._logService.debug("[CopilotApiService] GET models");
    const response = await capiClient.makeRequest(
      {
        method: "GET",
        headers: {
          ...options?.headers,
          "Authorization": `Bearer ${githubToken}`
        },
        // Opt-in per request — see
        // `ICopilotApiServiceRequestOptions.suppressIntegrationId`.
        suppressIntegrationId: options?.suppressIntegrationId,
        signal: options?.signal
      },
      { type: RequestType.Models }
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this._invalidateClientForToken(githubToken);
      }
      const text = await response.text().catch(() => "");
      throw buildCopilotApiHttpError(response.status, response.statusText, text, "CAPI models request failed");
    }
    const json = await response.json();
    return json.data ?? [];
  }
  async responses(githubToken, body, options) {
    const capiClient = await this._getClientForToken(githubToken);
    const requestId = generateUuid();
    let requestModel = "<unknown>";
    try {
      const parsed = JSON.parse(body);
      requestModel = parsed.model ?? "<none>";
    } catch {
    }
    this._logService.info(`[CopilotApiService] POST responses: requestId=${requestId}, model=${requestModel}`);
    const response = await capiClient.makeRequest(
      {
        method: "POST",
        headers: {
          ...options?.headers,
          "Content-Type": "application/json",
          "Authorization": `Bearer ${githubToken}`,
          "X-Request-Id": requestId,
          "OpenAI-Intent": "conversation"
        },
        // Opt-in per request — see
        // `ICopilotApiServiceRequestOptions.suppressIntegrationId`.
        suppressIntegrationId: options?.suppressIntegrationId,
        body,
        signal: options?.signal
      },
      { type: RequestType.ChatResponses }
    );
    this._logService.info(`[CopilotApiService] responses status=${response.status}, requestId=${requestId}`);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this._invalidateClientForToken(githubToken);
      }
      const text = await response.text().catch(() => "");
      throw buildCopilotApiHttpError(response.status, response.statusText, text, "CAPI responses request failed");
    }
    return response;
  }
  async utilityChatCompletion(githubToken, request, options) {
    const capiClient = await this._getClientForToken(githubToken);
    const copilotToken = await this._getCopilotToken(githubToken);
    const modelId = await this._resolveUtilityModelId(githubToken, UTILITY_DEFAULT_MODEL_FAMILY);
    const requestId = generateUuid();
    this._logService.debug("[CopilotApiService] POST chat completions", `model=${modelId} requestId=${requestId}`);
    const body = JSON.stringify({
      model: modelId,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      temperature: request.temperature ?? UTILITY_DEFAULT_TEMPERATURE,
      top_p: UTILITY_DEFAULT_TOP_P,
      max_tokens: request.maxTokens
    });
    const response = await capiClient.makeRequest(
      {
        method: "POST",
        headers: {
          ...options?.headers,
          "Content-Type": "application/json",
          "Authorization": `Bearer ${copilotToken}`,
          "X-Request-Id": requestId,
          "OpenAI-Intent": UTILITY_INTENT
        },
        body,
        signal: options?.signal
      },
      { type: RequestType.ChatCompletions }
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this._invalidateCopilotTokenForGithub(githubToken);
      }
      const text = await response.text().catch(() => "");
      throw buildCopilotApiHttpError(response.status, response.statusText, text, "CAPI chat completion request failed");
    }
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("CAPI chat completion returned no text content");
    }
    return content;
  }
  // #endregion
  // #region Lazy Init
  _getCapiBase() {
    if (!this._capiBasePromise) {
      this._capiBasePromise = this._buildCapiBase().catch((err) => {
        this._capiBasePromise = null;
        throw err;
      });
    }
    return this._capiBasePromise;
  }
  async _buildCapiBase() {
    const [machineId, deviceId] = await Promise.all([
      getMachineId((err) => this._logService.warn("[CopilotApiService] getMachineId failed", err)),
      getDevDeviceId((err) => this._logService.warn("[CopilotApiService] getDevDeviceId failed", err))
    ]);
    const extensionInfo = {
      name: "agent-host",
      sessionId: generateUuid(),
      machineId,
      deviceId,
      vscodeVersion: this._productService.version,
      version: this._productService.version,
      buildType: this._productService.quality === "stable" ? "prod" : "dev"
    };
    const userUrl = `${this._gitHubEndpointService.getApiBaseUri()}/copilot_internal/user`;
    return { extensionInfo, userUrl };
  }
  // #endregion
  // #region Streaming
  async *_messagesStreaming(githubToken, request, options) {
    const response = await this._sendRequest(githubToken, request, true, options);
    if (!response.body) {
      throw new Error("CAPI response has no body");
    }
    yield* this._readSSE(response.body);
  }
  // #endregion
  // #region Non-Streaming
  async _messagesNonStreaming(githubToken, request, options) {
    const response = await this._sendRequest(githubToken, request, false, options);
    return response.json();
  }
  // #endregion
  // #region Shared Request
  async _sendRequest(githubToken, request, stream, options) {
    const capiClient = await this._getClientForToken(githubToken);
    const requestId = generateUuid();
    this._logService.debug("[CopilotApiService] POST messages", `model=${request.model} stream=${stream} requestId=${requestId}`);
    const { system, ...rest } = request;
    const body = JSON.stringify({
      ...rest,
      stream,
      // CAPI requires system as a text-block array, not a raw string
      ...system !== void 0 ? { system: typeof system === "string" ? [{ type: "text", text: system }] : system } : {}
    });
    const response = await capiClient.makeRequest(
      {
        method: "POST",
        headers: {
          ...options?.headers,
          "Content-Type": "application/json",
          "Authorization": `Bearer ${githubToken}`,
          "X-Request-Id": requestId,
          "X-GitHub-Api-Version": "2026-01-09",
          // Should these be parameterized?
          "OpenAI-Intent": "messages-proxy",
          "X-Interaction-Type": "messages-proxy"
          // `X-Initiator` (user|agent) is intentionally omitted: the
          // user-vs-agent turn origin known to `ClaudeAgentSession` is not
          // plumbed across the SDK subprocess to this proxy, so a hardcoded
          // value would mislabel most agent-loop traffic. CAPI accepts the
          // request without it (the `responses()` and `utilityChatCompletion()`
          // paths already omit it). Thread a real per-turn initiator here if
          // that signal ever becomes available at the proxy boundary.
        },
        suppressIntegrationId: options?.suppressIntegrationId,
        body,
        signal: options?.signal
      },
      { type: RequestType.ChatMessages }
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this._invalidateClientForToken(githubToken);
      }
      const text = await response.text().catch(() => "");
      throw buildCopilotApiHttpError(response.status, response.statusText, text);
    }
    return response;
  }
  // #endregion
  // #region Per-Token Client
  /**
   * Resolve a {@link CAPIClient} that has had its domains updated for the
   * supplied user. Concurrent callers for the same token share one
   * `/copilot_internal/user` discovery via the cache map; callers with
   * different tokens get their **own** `CAPIClient` instance, so the
   * `updateDomains` mutation for token A can never affect a request being
   * dispatched for token B.
   */
  _getClientForToken(githubToken) {
    return this._getEntryForToken(githubToken).then((entry) => entry.capiClient);
  }
  /**
   * Resolve this user's restricted-telemetry context. Reads the `rt`/`tid` claims from the minted
   * CAPI Copilot session token (the GitHub token has neither), and resolves the CAPI
   * `endpoints.telemetry` host from the cached `/copilot_internal/user` discovery only when the
   * user is opted in, so public users pay no extra discovery call.
   */
  async resolveRestrictedTelemetryContext(githubToken) {
    const token = await this._getCopilotTokenEntry(githubToken);
    const client = await this._getEntryForToken(githubToken);
    const fields = parseCopilotTokenFields(token.token);
    const restrictedTelemetryEnabled = fields.get("rt") === "1";
    const trackingId = fields.get("tid");
    const telemetryEndpoint = restrictedTelemetryEnabled ? client.telemetryEndpoint : void 0;
    return {
      restrictedTelemetryEnabled,
      trackingId,
      telemetryEndpoint,
      isInternal: token.isInternal,
      userName: client.login,
      isVscodeTeamMember: token.isVscodeTeamMember,
      copilotIgnoreEnabled: client.copilotIgnoreEnabled
    };
  }
  async resolveApiEndpoint(githubToken) {
    return (await this._getEntryForToken(githubToken)).apiEndpoint;
  }
  async resolveUserLogin(githubToken) {
    return (await this._getEntryForToken(githubToken)).login;
  }
  _getEntryForToken(githubToken) {
    const nowSeconds = Date.now() / 1e3;
    const existing = this._clientsByToken.get(githubToken);
    if (existing) {
      return existing.then((entry) => {
        if (entry.expiresAt - nowSeconds > CAPI_CONTEXT_REFRESH_BUFFER_SECONDS) {
          return entry;
        }
        this._clientsByToken.delete(githubToken);
        return this._getEntryForToken(githubToken);
      }).catch((err) => {
        this._clientsByToken.delete(githubToken);
        throw err;
      });
    }
    const pending = this._buildClientForToken(githubToken).catch((err) => {
      this._clientsByToken.delete(githubToken);
      throw err;
    });
    this._clientsByToken.set(githubToken, pending);
    return pending;
  }
  _invalidateClientForToken(githubToken) {
    this._clientsByToken.delete(githubToken);
  }
  async _buildClientForToken(githubToken) {
    const { extensionInfo, userUrl } = await this._getCapiBase();
    const fetch = this._fetch;
    const capiClient = new CAPIClient(extensionInfo, COPILOT_LICENSE_AGREEMENT, {
      fetch: (url, options) => fetch(url, {
        method: options.method ?? "GET",
        headers: options.headers,
        body: options.body,
        signal: options.signal
      })
    });
    this._logService.debug("[CopilotApiService] Discovering CAPI endpoints via /copilot_internal/user");
    const overrideApi = process.env[CAPI_URL_OVERRIDE_ENV];
    if (overrideApi) {
      if (isAllowedCapiUrlOverride(overrideApi)) {
        this._logService.info(`[CopilotApiService] Using CAPI URL override ${overrideApi}; skipping endpoint discovery`);
        capiClient.updateDomains({ endpoints: { api: overrideApi, proxy: overrideApi }, sku: "" }, void 0);
        return {
          capiClient,
          expiresAt: Date.now() / 1e3 + CAPI_CONTEXT_TTL_SECONDS,
          apiEndpoint: overrideApi
        };
      }
      this._logService.warn(`[CopilotApiService] Ignoring non-loopback CAPI URL override ${overrideApi}; falling back to normal endpoint discovery`);
    }
    const response = await this._fetch(userUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/json",
        "X-GitHub-Api-Version": USER_API_VERSION
      }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Copilot endpoint discovery failed: ${response.status} ${response.statusText} \u2014 ${text}`);
    }
    const envelope = await response.json();
    capiClient.updateDomains(
      { endpoints: envelope.endpoints ?? {}, sku: envelope.access_type_sku ?? "" },
      // Enterprise base URI (e.g. `https://acme.ghe.com`), or `undefined` for
      // github.com. The package derives the GitHub API host (`api.<host>`) from
      // this for `copilot_internal` endpoints - notably the Copilot session
      // token mint (`/copilot_internal/v2/token`). Omitting it strands the mint
      // on `api.github.com`, which 401s an enterprise token ("Bad credentials").
      this._gitHubEndpointService.getEnterpriseUri()
    );
    this._logService.debug("[CopilotApiService] CAPI endpoint discovered, api=", envelope.endpoints?.api);
    return {
      capiClient,
      expiresAt: Date.now() / 1e3 + CAPI_CONTEXT_TTL_SECONDS,
      login: envelope.login,
      telemetryEndpoint: envelope.endpoints?.telemetry,
      apiEndpoint: envelope.endpoints?.api,
      copilotIgnoreEnabled: envelope.copilotignore_enabled
    };
  }
  // #endregion
  // #region Per-Token Copilot Session Token
  /**
   * Resolve the Copilot session token for a GitHub token, minting and
   * caching one if needed. Concurrent callers for the same GitHub token
   * share a single in-flight mint; the caller's `AbortSignal` is
   * deliberately NOT forwarded so cancelling one caller does not poison
   * the shared mint for the others.
   */
  _getCopilotToken(githubToken) {
    return this._getCopilotTokenEntry(githubToken).then((entry) => entry.token);
  }
  _getCopilotTokenEntry(githubToken) {
    const nowSeconds = Date.now() / 1e3;
    const existing = this._copilotTokensByGithub.get(githubToken);
    if (existing) {
      return existing.then((entry) => {
        if (entry.expiresAt - nowSeconds > COPILOT_TOKEN_REFRESH_BUFFER_SECONDS) {
          return entry;
        }
        if (this._copilotTokensByGithub.get(githubToken) === existing) {
          this._copilotTokensByGithub.delete(githubToken);
        }
        return this._getCopilotTokenEntry(githubToken);
      }).catch((err) => {
        if (this._copilotTokensByGithub.get(githubToken) === existing) {
          this._copilotTokensByGithub.delete(githubToken);
        }
        throw err;
      });
    }
    const pending = this._buildCopilotToken(githubToken).catch((err) => {
      if (this._copilotTokensByGithub.get(githubToken) === pending) {
        this._copilotTokensByGithub.delete(githubToken);
      }
      throw err;
    });
    this._copilotTokensByGithub.set(githubToken, pending);
    return pending;
  }
  _invalidateCopilotTokenForGithub(githubToken) {
    this._copilotTokensByGithub.delete(githubToken);
  }
  async _buildCopilotToken(githubToken) {
    const capiClient = await this._getClientForToken(githubToken);
    this._logService.debug("[CopilotApiService] Minting Copilot session token");
    const response = await capiClient.makeRequest(
      {
        method: "GET",
        headers: {
          "Authorization": `token ${githubToken}`,
          "X-GitHub-Api-Version": USER_API_VERSION
        }
      },
      { type: RequestType.CopilotToken }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Copilot session token mint failed: ${response.status} ${response.statusText} \u2014 ${text}`);
    }
    const envelope = await response.json();
    if (typeof envelope.token !== "string" || typeof envelope.expires_at !== "number") {
      throw new Error("Copilot session token mint returned malformed envelope");
    }
    const nowSeconds = Date.now() / 1e3;
    const refreshIn = typeof envelope.refresh_in === "number" ? envelope.refresh_in : void 0;
    const organizationList = Array.isArray(envelope.organization_list) ? envelope.organization_list.filter((organization) => typeof organization === "string") : [];
    const expiresAt = Math.max(
      refreshIn !== void 0 ? nowSeconds + refreshIn : envelope.expires_at,
      nowSeconds + 60
    );
    return {
      token: envelope.token,
      expiresAt,
      modelIdsByFamily: /* @__PURE__ */ new Map(),
      isInternal: organizationList.some((organization) => INTERNAL_COPILOT_ORGANIZATIONS.has(organization)),
      isVscodeTeamMember: organizationList.some((organization) => VSCODE_COPILOT_ORGANIZATIONS.has(organization))
    };
  }
  /**
   * Resolve the concrete CAPI model id for the supplied family (e.g.
   * `gpt-4o-mini`). Cached per GitHub token + family alongside the
   * Copilot session token so eviction on 401/403 also clears the cached
   * model id.
   */
  async _resolveUtilityModelId(githubToken, modelFamily) {
    const pendingEntry = this._copilotTokensByGithub.get(githubToken);
    const entry = pendingEntry ? await pendingEntry : void 0;
    const cached = entry?.modelIdsByFamily.get(modelFamily);
    if (cached) {
      return cached;
    }
    const models = await this.models(githubToken);
    const match = models.find((m) => m.capabilities?.family === modelFamily);
    if (!match) {
      throw new Error(`No CAPI model available for family '${modelFamily}'`);
    }
    entry?.modelIdsByFamily.set(modelFamily, match.id);
    return match.id;
  }
  // #endregion
  // #region SSE Parsing
  async *_readSSE(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const event = this._parseDataLine(line);
          if (event !== void 0) {
            yield event;
            if (event.type === "message_stop") {
              return;
            }
          }
        }
      }
      if (buffer.trim()) {
        const event = this._parseDataLine(buffer);
        if (event !== void 0) {
          yield event;
          if (event.type === "message_stop") {
            return;
          }
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
      }
      reader.releaseLock();
    }
  }
  /**
   * @returns the parsed stream event, or `undefined` to skip the line.
   * @throws on `error` events from the server.
   */
  _parseDataLine(line) {
    if (!line.startsWith("data: ")) {
      return void 0;
    }
    const data = line.slice("data: ".length).trim();
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      this._logService.warn("[CopilotApiService] Failed to parse SSE data:", data);
      return void 0;
    }
    if (typeof parsed !== "object" || parsed === null) {
      return void 0;
    }
    const record = parsed;
    const type = record.type;
    if (typeof type !== "string") {
      return void 0;
    }
    if (type === "error") {
      const rawError = parsed.error;
      let envelope;
      if (rawError && typeof rawError === "object" && typeof rawError.type === "string" && typeof rawError.message === "string") {
        envelope = parsed;
      } else {
        let errorMessage;
        if (typeof rawError === "string") {
          errorMessage = rawError;
        } else if (typeof rawError?.message === "string") {
          errorMessage = rawError.message;
        } else {
          errorMessage = "Unknown streaming error";
        }
        envelope = {
          type: "error",
          error: { type: "api_error", message: errorMessage },
          request_id: null
        };
      }
      throw new CopilotApiError(COPILOT_API_ERROR_STATUS_STREAMING, envelope);
    }
    if (!KNOWN_SSE_EVENT_TYPES.has(type)) {
      return void 0;
    }
    return parsed;
  }
  // #endregion
};
CopilotApiService = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IAgentHostGitHubEndpointService)
], CopilotApiService);
const KNOWN_SSE_EVENT_TYPES = /* @__PURE__ */ new Set([
  "message_start",
  "message_delta",
  "message_stop",
  "content_block_start",
  "content_block_delta",
  "content_block_stop"
]);
export {
  COPILOT_API_ERROR_STATUS_STREAMING,
  CopilotApiError,
  CopilotApiService,
  ICopilotApiService
};
