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
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { isCancellationError } from "../../../../../base/common/errors.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import {
  CLOUD_SANDBOX_AGENT_SLUG,
  CloudSandboxAuthenticationRequiredError,
  CloudSandboxRequestError
} from "../../../../../platform/agentHost/common/cloudSandboxAgentHost.js";
import { GITHUB_DOT_COM_COPILOT_API_BASE_URI } from "../../../../../platform/agentHost/common/githubEndpoints.js";
import { parseTaskEventsResponse, replayTaskAhpEvents, TaskEventReplayError } from "../../../../../platform/agentHost/common/taskEventReplay.js";
import { COPILOT_INTEGRATION_ID } from "../../../../../platform/endpoint/common/licenseAgreement.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { asText, IRequestService } from "../../../../../platform/request/common/request.js";
import { IAuthenticationService } from "../../../../../workbench/services/authentication/common/authentication.js";
import { ICloudSandboxTelemetryService, requestOutcomeForStatus } from "./cloudSandboxTelemetry.js";
const LOG_PREFIX = "[CloudSandboxApi]";
const REQUEST_TIMEOUT_MS = 1e4;
const DISCOVERY_TIMEOUT_MS = 3e4;
const DEFAULT_WAKING_RETRY_AFTER_SECONDS = 5;
const DISCOVERY_TASK_SCAN_LIMIT = 100;
const FALLBACK_SCOPES = ["read:user", "user:email", "repo", "workflow"];
let CloudSandboxApiService = class extends Disposable {
  constructor(_requestService, _authenticationService, _productService, _logService, _telemetry) {
    super();
    this._requestService = _requestService;
    this._authenticationService = _authenticationService;
    this._productService = _productService;
    this._logService = _logService;
    this._telemetry = _telemetry;
  }
  async connect(request, token) {
    return this._connectRequest("connect", request.environmentId, token, {
      ...request.sessionId && { session_id: request.sessionId }
    });
  }
  async reconnect(request, clientId, token) {
    return this._connectRequest("reconnect", request.environmentId, token, {
      client_id: clientId,
      ...request.sessionId && { session_id: request.sessionId }
    });
  }
  async getEnvironment(environmentId, token) {
    const context = await this._sendEnvironment("get", environmentId, token);
    if (!isSuccess(context)) {
      await this._throwForStatus("get", context);
    }
    const environment = await this._readJson(context);
    if (!environment?.status) {
      throw new Error("Mission Control get returned an incomplete environment response");
    }
    this._logService.trace(`${LOG_PREFIX} Environment ${environmentId}: status=${environment.status}, ahp=${environment.capabilities?.ahp_version ?? "unknown"}`);
    return environment;
  }
  /**
   * Enumerate sandbox-backed cloud sessions by scanning recent tasks and resolving each one's
   * Mission Control environment binding.
   *
   * The result distinguishes a full scan from a partial or failed one: a caller that reconciles
   * against this list would otherwise treat a transient request failure as "these sessions no
   * longer exist" and tear down live providers.
   */
  async listSessions(token) {
    let tasks;
    try {
      const context = await this._sendTask(`${this._tasksBaseUrl()}/tasks?per_page=${DISCOVERY_TASK_SCAN_LIMIT}`, "list", token);
      const response = await this._readJson(context);
      if (!response?.tasks) {
        return { kind: "failed", reason: `listTasks returned no 'tasks' array` };
      }
      tasks = response.tasks;
    } catch (error) {
      return { kind: "failed", reason: `listTasks failed: ${toErrorMessage(error)}` };
    }
    const sandboxTasks = tasks.filter((task) => !task.archived_at && isCloudSandboxTask(task));
    let unresolved = 0;
    const discovered = await Promise.all(sandboxTasks.map(async (task) => {
      try {
        const context = await this._sendTask(`${this._tasksBaseUrl()}/tasks/${encodeURIComponent(task.id)}`, "get", token);
        const full = await this._readJson(context);
        if (!full) {
          unresolved++;
          return void 0;
        }
        const binding = getTaskEnvironmentBinding(full);
        if (!binding) {
          return void 0;
        }
        const repo = parseRepoFromTaskUrl(full.html_url);
        return {
          environmentId: binding.environmentId,
          sessionId: binding.sessionId,
          taskId: task.id,
          name: full.name ?? task.name ?? `Sandbox ${task.id}`,
          repoName: repo ? `${repo.owner}/${repo.name}` : void 0,
          updatedAt: full.updated_at ?? task.updated_at
        };
      } catch (error) {
        this._logService.warn(`${LOG_PREFIX} Discovery getTask ${task.id} failed: ${toErrorMessage(error)}`);
        unresolved++;
        return void 0;
      }
    }));
    const sessions = discovered.filter((session) => session !== void 0);
    this._logService.info(`${LOG_PREFIX} Discovery found ${sessions.length} sandbox session(s) from ${sandboxTasks.length} sandbox task(s) out of ${tasks.length} scanned${unresolved > 0 ? `; ${unresolved} unresolved` : ""}.`);
    return { kind: unresolved > 0 ? "partial" : "complete", sessions };
  }
  /**
   * Read a task's persisted AHP history and fold it into session/chat state.
   *
   * The only history path that survives the sandbox: `/events` is served by Mission Control's
   * mirror, not the environment. The `vnd.github.ahp+json` media type selects the raw relayed
   * frames rather than the cloud-task event summaries the endpoint serves by default.
   */
  async getSessionHistory(taskId, token) {
    const url = `${this._tasksBaseUrl()}/tasks/${encodeURIComponent(taskId)}/events`;
    const context = await this._request(url, "mc.taskClient.events", "getTaskEvents", {
      "Accept": "application/vnd.github.ahp+json",
      "Copilot-Integration-Id": COPILOT_INTEGRATION_ID
    }, token, DISCOVERY_TIMEOUT_MS);
    if (!isSuccess(context)) {
      await this._throwForStatus("task events", context);
    }
    const body = await this._readJson(context);
    if (body === void 0) {
      throw new TaskEventReplayError("Task AHP history response was empty or not JSON.");
    }
    return replayTaskAhpEvents(parseTaskEventsResponse(body));
  }
  /** Shared handler for the `connect`/`reconnect` endpoints (200 token or 202 waking). */
  async _connectRequest(action, environmentId, token, searchParams) {
    const context = await this._sendEnvironment(action, environmentId, token, searchParams);
    if (context.res.statusCode === 202) {
      const retryAfterSeconds = parseRetryAfter(context.res.headers?.["retry-after"]);
      this._logService.debug(`${LOG_PREFIX} ${action}: environment waking, retry after ${retryAfterSeconds}s`);
      return { kind: "waking", waking: { retryAfterSeconds } };
    }
    if (!isSuccess(context)) {
      await this._throwForStatus(action, context);
    }
    const clientToken = await this._readJson(context);
    if (!clientToken?.access_token || !clientToken?.wps_endpoint || !clientToken?.client_id || !clientToken?.groups) {
      throw new Error(`Mission Control ${action} returned an incomplete token response`);
    }
    return { kind: "token", token: clientToken };
  }
  /**
   * Issue an agent-environment request and return the raw response. The caller owns status
   * handling, since the meaning of a status is endpoint-specific (notably HTTP 202 = "waking",
   * which is neither an error nor a result).
   */
  async _sendEnvironment(action, environmentId, token, searchParams) {
    const path = action === "get" ? "" : `/${action}`;
    const url = `${GITHUB_DOT_COM_COPILOT_API_BASE_URI}/agents/environments/${encodeURIComponent(environmentId)}${path}${toQuery(searchParams)}`;
    return this._request(url, `mc.environmentClient.${action}`, action === "get" ? "getEnvironment" : action, {
      "Copilot-Integration-Id": COPILOT_INTEGRATION_ID
    }, token);
  }
  /** Issue a task API request, throwing on a non-success status. */
  async _sendTask(url, action, token) {
    const context = await this._request(url, `mc.taskClient.${action}`, action === "list" ? "listTasks" : "getTask", {
      "Accept": "application/json",
      "Copilot-Integration-Id": COPILOT_INTEGRATION_ID
    }, token, DISCOVERY_TIMEOUT_MS);
    if (!isSuccess(context)) {
      await this._throwForStatus(`task ${action}`, context);
    }
    return context;
  }
  async _request(url, callSite, action, headers, token, timeout = REQUEST_TIMEOUT_MS) {
    const accessToken = await this._resolveGitHubToken();
    if (!accessToken) {
      throw new CloudSandboxAuthenticationRequiredError();
    }
    const started = Date.now();
    try {
      const context = await this._requestService.request({
        type: "GET",
        url,
        headers: { ...headers, ["Authorization"]: `Bearer ${accessToken}` },
        timeout,
        callSite
      }, token);
      this._telemetry.reportRequest(action, requestOutcomeForStatus(context.res.statusCode));
      this._logService.trace(`${LOG_PREFIX} ${action} -> HTTP ${context.res.statusCode ?? "none"} in ${Date.now() - started}ms (budget ${timeout}ms)${context.res.headers?.["retry-after"] ? `, Retry-After: ${context.res.headers["retry-after"]}` : ""}`);
      return context;
    } catch (error) {
      if (!isCancellationError(error) && !token.isCancellationRequested) {
        this._telemetry.reportRequest(action, "networkError");
      }
      this._logService.trace(`${LOG_PREFIX} ${action} -> failed after ${Date.now() - started}ms (budget ${timeout}ms)`);
      this._logService.error(`${LOG_PREFIX} GET ${url} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }
  /**
   * Mission Control task API base. Uses the Copilot API host: `api.github.com/agents/*` omits
   * CORS headers on authenticated responses, so a renderer `fetch` receives the reply and discards it.
   */
  _tasksBaseUrl() {
    return `${GITHUB_DOT_COM_COPILOT_API_BASE_URI}/agents`;
  }
  async _readJson(context) {
    const body = await asText(context);
    if (!body) {
      return void 0;
    }
    try {
      return JSON.parse(body);
    } catch {
      return void 0;
    }
  }
  /** Throw a diagnosable error for a non-success response, including the body when readable. */
  async _throwForStatus(action, context) {
    const body = await asText(context).catch(() => "");
    const status = context.res.statusCode;
    throw new CloudSandboxRequestError(
      status,
      `Mission Control ${action} failed: HTTP ${status ?? "unknown"} - ${(body ?? "").slice(0, 200)}`
    );
  }
  /** A GitHub session carrying at least the configured chat provider scopes. */
  async _resolveGitHubToken() {
    const providerId = this._productService.defaultChatAgent?.provider?.default?.id ?? "github";
    const scopes = this._productService.defaultChatAgent?.providerScopes?.[0] ?? FALLBACK_SCOPES;
    let exact;
    try {
      exact = await this._authenticationService.getSessions(providerId, [...scopes], void 0, true);
    } catch (error) {
      this._logService.warn(`${LOG_PREFIX} getSessions('${providerId}') failed: ${toErrorMessage(error)}`);
      return void 0;
    }
    if (exact.length > 0) {
      return exact[0].accessToken;
    }
    const all = await this._authenticationService.getSessions(providerId, void 0, void 0, true);
    const required = new Set(scopes);
    let best;
    for (const session of all) {
      const granted = new Set(session.scopes);
      if ([...required].every((scope) => granted.has(scope))) {
        const extra = granted.size - required.size;
        if (!best || extra < best.extra) {
          best = { token: session.accessToken, extra };
        }
      }
    }
    if (!best) {
      this._logService.warn(`${LOG_PREFIX} No '${providerId}' session with scopes [${scopes.join(", ")}]`);
    }
    return best?.token;
  }
};
CloudSandboxApiService = __decorateClass([
  __decorateParam(0, IRequestService),
  __decorateParam(1, IAuthenticationService),
  __decorateParam(2, IProductService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ICloudSandboxTelemetryService)
], CloudSandboxApiService);
function isSuccess(context) {
  const status = context.res.statusCode ?? 0;
  return status >= 200 && status < 300;
}
function toQuery(searchParams) {
  if (!searchParams) {
    return "";
  }
  const search = new URLSearchParams(searchParams).toString();
  return search ? `?${search}` : "";
}
function parseRetryAfter(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw) {
    const seconds = Number.parseInt(raw, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds;
    }
  }
  return DEFAULT_WAKING_RETRY_AFTER_SECONDS;
}
function isCloudSandboxTask(task) {
  const isCloudCodingAgent = task.agent_collaborators?.some((c) => c.slug === CLOUD_SANDBOX_AGENT_SLUG) ?? false;
  return isCloudCodingAgent && task.compute?.provider === "sandboxes";
}
function getTaskEnvironmentBinding(task) {
  for (const session of task.sessions ?? []) {
    if (session.environment_id && session.environment_id.length > 0 && session.id.length > 0) {
      return { environmentId: session.environment_id, sessionId: session.id };
    }
  }
  return void 0;
}
function parseRepoFromTaskUrl(htmlUrl) {
  if (!htmlUrl) {
    return void 0;
  }
  try {
    const match = new URL(htmlUrl).pathname.match(/^\/([^/]+)\/([^/]+)\//);
    if (match) {
      return { owner: match[1], name: match[2] };
    }
  } catch {
  }
  return void 0;
}
export {
  CloudSandboxApiService
};
