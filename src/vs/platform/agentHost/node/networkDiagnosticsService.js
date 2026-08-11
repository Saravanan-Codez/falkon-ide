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
import { lookup } from "dns";
import { streamToBuffer } from "../../../base/common/buffer.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { IRequestService, NO_FETCH_TELEMETRY } from "../../request/common/request.js";
import { IAgentHostProxyResolver } from "./agentHostProxyResolver.js";
const INetworkDiagnosticsService = createDecorator("networkDiagnosticsService");
const PROBE_TIMEOUT_MS = 1e4;
const MAX_BODY_CHARS = 64 * 1024;
const PROXY_ENV_KEYS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy", "NO_PROXY", "no_proxy"];
const PROXY_CONFIG_KEYS = ["http.proxy", "http.proxyStrictSSL", "http.proxySupport", "http.noProxy"];
let NetworkDiagnosticsService = class {
  constructor(_requestService, _proxyResolver, _configurationService, _productService, _logService) {
    this._requestService = _requestService;
    this._proxyResolver = _proxyResolver;
    this._configurationService = _configurationService;
    this._productService = _productService;
    this._logService = _logService;
  }
  async getInfo(endpoints, account) {
    const proxyEnv = {};
    for (const key of PROXY_ENV_KEYS) {
      const value = process.env[key];
      if (value) {
        proxyEnv[key] = value;
      }
    }
    const proxySettings = {};
    for (const key of PROXY_CONFIG_KEYS) {
      const value = this._configurationService.getValue(key);
      if (value === void 0 || value === "" || Array.isArray(value) && value.length === 0) {
        continue;
      }
      proxySettings[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }
    return {
      version: this._productService.version,
      os: process.platform,
      arch: process.arch,
      account,
      proxySettings,
      proxyEnv,
      endpoints
    };
  }
  /**
   * Probe connectivity from the agent host process to a single `url`. Resolves
   * the proxy (for reporting), performs an IPv4 DNS lookup, and then a
   * reachability request through {@link IRequestService} — so the probe
   * traverses the same proxy / TLS / certificate stack the rest of VS Code
   * uses. Each step is individually timed and never throws; failures are
   * captured on the result.
   */
  async fetch(url) {
    const target = new URL(url);
    const host = target.hostname;
    const [dnsIpv4, dnsIpv6] = await Promise.all([
      resolveDns(host, 4),
      resolveDns(host, 6)
    ]);
    let proxyUrl;
    try {
      proxyUrl = await this._proxyResolver.resolveProxy(url);
    } catch (err) {
      this._logService.debug(`[AgentHost] Network diagnostics: proxy resolution for ${url} failed: ${errorMessage(err)}`);
    }
    const base = {
      url,
      proxyUrl,
      dnsIpv4,
      dnsIpv6
    };
    const probeStart = Date.now();
    try {
      const context = await this._requestService.request({
        url,
        type: "GET",
        timeout: PROBE_TIMEOUT_MS,
        callSite: NO_FETCH_TELEMETRY
      }, CancellationToken.None);
      const body = (await streamToBuffer(context.stream)).toString();
      return {
        ...base,
        statusCode: context.res.statusCode,
        body: body.length > MAX_BODY_CHARS ? body.slice(0, MAX_BODY_CHARS) : body,
        durationMs: Date.now() - probeStart
      };
    } catch (err) {
      return {
        ...base,
        error: errorMessage(err),
        durationMs: Date.now() - probeStart
      };
    }
  }
};
NetworkDiagnosticsService = __decorateClass([
  __decorateParam(0, IRequestService),
  __decorateParam(1, IAgentHostProxyResolver),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IProductService),
  __decorateParam(4, ILogService)
], NetworkDiagnosticsService);
function dnsLookup(host, family) {
  return new Promise((resolve, reject) => {
    lookup(host, { family }, (err, address) => err ? reject(err) : resolve(address));
  });
}
async function resolveDns(host, family) {
  const start = Date.now();
  try {
    const address = await withTimeout(dnsLookup(host, family), PROBE_TIMEOUT_MS);
    return { address, durationMs: Date.now() - start };
  } catch (err) {
    return { durationMs: Date.now() - start, error: errorMessage(err) };
  }
}
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1e3}s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
function errorMessage(error) {
  const seen = /* @__PURE__ */ new Set();
  function collect(error2) {
    if (seen.has(error2)) {
      return "";
    }
    seen.add(error2);
    if (!(error2 instanceof Error)) {
      return String(error2);
    }
    const details = [
      error2.cause ? collect(error2.cause) : "",
      ...error2 instanceof AggregateError ? error2.errors.map(collect) : []
    ].filter(Boolean).join(", ");
    return details ? `${error2.message}: ${details}` : error2.message;
  }
  return collect(error);
}
export {
  INetworkDiagnosticsService,
  NetworkDiagnosticsService
};
