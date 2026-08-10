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
import { disposableTimeout } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { CancellationError, isCancellationError } from "../../../../../base/common/errors.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import {
  ICloudSandboxApiService,
  isRetryableCloudSandboxError
} from "../../../../../platform/agentHost/common/cloudSandboxAgentHost.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ICloudSandboxTelemetryService } from "./cloudSandboxTelemetry.js";
const LOG_PREFIX = "[CloudSandboxAgentHost]";
const CREDENTIAL_REFRESH_LEAD_MS = 6e4;
const MIN_CREDENTIAL_REFRESH_DELAY_MS = 3e4;
const MAX_CREDENTIAL_REFRESH_DELAY_MS = 55 * 6e4;
const CREDENTIAL_REFRESH_RETRY_MS = 3e4;
const MAX_CONSECUTIVE_CREDENTIAL_REFRESH_FAILURES = 10;
const CREDENTIAL_REFRESH_FALLBACK_MS = 15 * 6e4;
const MAX_WAKING_DELAY_MS = 3e4;
function credentialRefreshDelayMs(expiresAt, now = Date.now()) {
  const expiryMs = expiresAt ? Date.parse(expiresAt) : NaN;
  if (Number.isNaN(expiryMs)) {
    return void 0;
  }
  const delay = expiryMs - now - CREDENTIAL_REFRESH_LEAD_MS;
  return Math.min(MAX_CREDENTIAL_REFRESH_DELAY_MS, Math.max(MIN_CREDENTIAL_REFRESH_DELAY_MS, delay));
}
let CloudSandboxCredentialRefresher = class extends Disposable {
  constructor(_address, _request, _clientId, _creds, _apiService, _telemetry, _logService) {
    super();
    this._address = _address;
    this._request = _request;
    this._clientId = _clientId;
    this._creds = _creds;
    this._apiService = _apiService;
    this._telemetry = _telemetry;
    this._logService = _logService;
    this._timer = this._register(new MutableDisposable());
    /**
     * A `MutableDisposable` silently drops a value assigned after it is disposed, so a timeout armed
     * while a refresh was in flight — the connection can go away mid-request — would never be
     * cancelled and would keep calling `/reconnect` for the life of the window. Cancelling on
     * teardown both aborts the in-flight request and stops anything being armed afterwards.
     */
    this._cts = new CancellationTokenSource();
    /** Consecutive cycles that did not yield a healthy, long-lived token. */
    this._unhealthyCycles = 0;
    this._register(toDisposable(() => this._cts.dispose(true)));
    const initialDelayMs = credentialRefreshDelayMs(this._creds.token.expires_at);
    if (initialDelayMs === void 0) {
      this._armUnhealthy(CREDENTIAL_REFRESH_FALLBACK_MS, "unusableToken", `tokens kept arriving without a usable 'expires_at'`);
      return;
    }
    this._arm(initialDelayMs);
  }
  _stop(reason, detail, error) {
    this._timer.clear();
    this._telemetry.reportCredentialRefreshStopped(reason, this._unhealthyCycles, error);
    this._logService.error(`${LOG_PREFIX} Stopped refreshing credentials for ${this._address}: ${detail}. The connection will drop when the current token expires.`);
  }
  _arm(delayMs) {
    if (this._cts.token.isCancellationRequested) {
      return;
    }
    this._timer.value = disposableTimeout(() => void this._refresh(), Math.max(MIN_CREDENTIAL_REFRESH_DELAY_MS, delayMs));
  }
  /** Re-arm after a cycle that produced no usable token, giving up once too many pile up. */
  _armUnhealthy(delayMs, reason, detail) {
    if (++this._unhealthyCycles >= MAX_CONSECUTIVE_CREDENTIAL_REFRESH_FAILURES) {
      this._stop(reason, `${detail} across ${this._unhealthyCycles} consecutive attempts`);
      return;
    }
    this._arm(delayMs);
  }
  async _refresh() {
    let result;
    try {
      result = await this._apiService.reconnect(this._request, this._clientId, this._cts.token);
    } catch (err) {
      if (this._cts.token.isCancellationRequested || isCancellationError(err) || err instanceof CancellationError) {
        return;
      }
      if (!isRetryableCloudSandboxError(err)) {
        this._stop("permanentError", toErrorMessage(err), err);
        return;
      }
      this._logService.warn(`${LOG_PREFIX} Credential refresh failed for ${this._address}; retrying`, err);
      this._armUnhealthy(CREDENTIAL_REFRESH_RETRY_MS, "consecutiveFailures", "credential refresh kept failing");
      return;
    }
    if (this._cts.token.isCancellationRequested) {
      return;
    }
    if (result.kind === "waking") {
      this._armUnhealthy(Math.min(result.waking.retryAfterSeconds * 1e3, MAX_WAKING_DELAY_MS), "environmentWaking", "environment kept reporting waking");
      return;
    }
    this._creds.token = result.token.encrypted_github_token ? result.token : { ...result.token, encrypted_github_token: this._creds.token.encrypted_github_token, host_encryption_key: this._creds.token.host_encryption_key };
    this._logService.trace(`${LOG_PREFIX} Refreshed Web PubSub credentials for ${this._address}`);
    const delayMs = credentialRefreshDelayMs(result.token.expires_at);
    if (delayMs === void 0) {
      this._armUnhealthy(CREDENTIAL_REFRESH_FALLBACK_MS, "unusableToken", `tokens kept arriving without a usable 'expires_at'`);
      return;
    }
    if (delayMs <= MIN_CREDENTIAL_REFRESH_DELAY_MS) {
      this._armUnhealthy(delayMs, "unusableToken", "refreshed tokens kept expiring immediately");
      return;
    }
    this._unhealthyCycles = 0;
    this._arm(delayMs);
  }
};
CloudSandboxCredentialRefresher = __decorateClass([
  __decorateParam(4, ICloudSandboxApiService),
  __decorateParam(5, ICloudSandboxTelemetryService),
  __decorateParam(6, ILogService)
], CloudSandboxCredentialRefresher);
export {
  CloudSandboxCredentialRefresher,
  MAX_CONSECUTIVE_CREDENTIAL_REFRESH_FAILURES,
  MAX_WAKING_DELAY_MS,
  MIN_CREDENTIAL_REFRESH_DELAY_MS,
  credentialRefreshDelayMs
};
