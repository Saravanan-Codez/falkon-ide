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
import { parse as parseUrl } from "url";
import { Promises, timeout } from "../../../base/common/async.js";
import { streamToBufferReadableStream } from "../../../base/common/buffer.js";
import { CancellationError, getErrorMessage } from "../../../base/common/errors.js";
import { isBoolean, isNumber } from "../../../base/common/types.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { getResolvedShellEnv } from "../../shell/node/shellEnv.js";
import { ILogService } from "../../log/common/log.js";
import { AbstractRequestService, systemCertificatesNodeDefault } from "../common/request.js";
import { getProxyAgent } from "./proxy.js";
import { createGunzip } from "zlib";
const TRANSIENT_ERROR_CODES = /* @__PURE__ */ new Set([
  "EAI_AGAIN",
  // DNS lookup timed out
  "ECONNREFUSED",
  // Connection refused by server
  "EHOSTDOWN",
  // Host is down
  "EHOSTUNREACH",
  // No route to host
  "ENETDOWN",
  // Network is down
  "ENETUNREACH",
  // Network is unreachable
  "EPROTO"
  // Protocol error (TLS/SSL handshake failure)
]);
const IDEMPOTENT_HTTP_METHODS_REGEX = /^(GET|HEAD|OPTIONS)$/i;
function isTransientError(error) {
  if (error instanceof Error) {
    const code = error.code;
    return !!code && TRANSIENT_ERROR_CODES.has(code);
  }
  return false;
}
let RequestService = class extends AbstractRequestService {
  constructor(machine, configurationService, environmentService, logService) {
    super(logService);
    this.machine = machine;
    this.configurationService = configurationService;
    this.environmentService = environmentService;
    this.configure();
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("http")) {
        this.configure();
      }
    }));
  }
  configure() {
    this.proxyUrl = this.getConfigValue("http.proxy");
    this.strictSSL = !!this.getConfigValue("http.proxyStrictSSL");
    this.authorization = this.getConfigValue("http.proxyAuthorization");
  }
  async request(options, token) {
    const { proxyUrl, strictSSL } = this;
    let shellEnv = void 0;
    try {
      shellEnv = await getResolvedShellEnv(this.configurationService, this.logService, this.environmentService.args, process.env);
    } catch (error) {
      if (!this.shellEnvErrorLogged) {
        this.shellEnvErrorLogged = true;
        this.logService.error(`resolving shell environment failed`, getErrorMessage(error));
      }
    }
    const env = {
      ...process.env,
      ...shellEnv
    };
    const agent = options.agent ? options.agent : await getProxyAgent(options.url || "", env, { proxyUrl, strictSSL });
    options.agent = agent;
    options.strictSSL = strictSSL;
    if (this.authorization) {
      options.headers = {
        ...options.headers || {},
        "Proxy-Authorization": this.authorization
      };
    }
    return this.logAndRequest(options, () => nodeRequest(options, token));
  }
  async resolveProxy(url) {
    return void 0;
  }
  async lookupAuthorization(authInfo) {
    return void 0;
  }
  async lookupKerberosAuthorization(urlStr) {
    try {
      const spnConfig = this.getConfigValue("http.proxyKerberosServicePrincipal");
      const response = await lookupKerberosAuthorization(urlStr, spnConfig, this.logService, "RequestService#lookupKerberosAuthorization");
      return "Negotiate " + response;
    } catch (err) {
      this.logService.debug("RequestService#lookupKerberosAuthorization Kerberos authentication failed", err);
      return void 0;
    }
  }
  async loadCertificates() {
    const proxyAgent = await import("@vscode/proxy-agent");
    return proxyAgent.loadSystemCertificates({
      loadSystemCertificatesFromNode: () => this.getConfigValue("http.systemCertificatesNode", systemCertificatesNodeDefault),
      log: this.logService
    });
  }
  getConfigValue(key, fallback) {
    if (this.machine === "remote") {
      return this.configurationService.getValue(key);
    }
    const values = this.configurationService.inspect(key);
    return values.userLocalValue ?? values.defaultValue ?? fallback;
  }
};
RequestService = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, INativeEnvironmentService),
  __decorateParam(3, ILogService)
], RequestService);
async function lookupKerberosAuthorization(urlStr, spnConfig, logService, logPrefix) {
  const importKerberos = await import("kerberos");
  const kerberos = importKerberos.default || importKerberos;
  const url = new URL(urlStr);
  const spn = spnConfig || (process.platform === "win32" ? `HTTP/${url.hostname}` : `HTTP@${url.hostname}`);
  logService.debug(`${logPrefix} Kerberos authentication lookup`, `proxyURL:${url}`, `spn:${spn}`);
  const client = await kerberos.initializeClient(spn);
  return client.step("");
}
async function getNodeRequest(options) {
  const endpoint = parseUrl(options.url);
  const module = endpoint.protocol === "https:" ? await import("https") : await import("http");
  return module.request;
}
async function nodeRequest(options, token) {
  const maxRetries = 3;
  let lastError;
  const isIdempotent = IDEMPOTENT_HTTP_METHODS_REGEX.test(options.type || "GET");
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await nodeRequestAttempt(options, token);
    } catch (error) {
      lastError = error;
      if (error instanceof CancellationError) {
        throw error;
      }
      if (!isIdempotent || !isTransientError(error) || attempt === maxRetries) {
        throw error;
      }
      await timeout(100 * attempt, token);
    }
  }
  throw lastError;
}
async function nodeRequestAttempt(options, token) {
  return Promises.withAsyncBody(async (resolve, reject) => {
    const endpoint = parseUrl(options.url);
    const rawRequest = options.getRawRequest ? options.getRawRequest(options) : await getNodeRequest(options);
    const opts = {
      hostname: endpoint.hostname,
      port: endpoint.port ? parseInt(endpoint.port) : endpoint.protocol === "https:" ? 443 : 80,
      protocol: endpoint.protocol,
      path: endpoint.path,
      method: options.type || "GET",
      headers: options.headers,
      agent: options.agent,
      rejectUnauthorized: isBoolean(options.strictSSL) ? options.strictSSL : true
    };
    if (options.user && options.password) {
      opts.auth = options.user + ":" + options.password;
    }
    if (options.disableCache) {
      opts.cache = "no-store";
    }
    const req = rawRequest(opts, (res) => {
      const followRedirects = isNumber(options.followRedirects) ? options.followRedirects : 3;
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && followRedirects > 0 && res.headers["location"]) {
        nodeRequest({
          ...options,
          url: res.headers["location"],
          followRedirects: followRedirects - 1
        }, token).then(resolve, reject);
      } else {
        let stream = res;
        if (!options.isChromiumNetwork && res.headers["content-encoding"] === "gzip") {
          stream = res.pipe(createGunzip());
        }
        resolve({ res, stream: streamToBufferReadableStream(stream) });
      }
    });
    req.on("error", reject);
    if (options.timeout) {
      if (options.isChromiumNetwork) {
        const timeout2 = setTimeout(() => {
          req.abort();
          reject(new Error(`Request timeout after ${options.timeout}ms`));
        }, options.timeout);
        req.on("response", () => clearTimeout(timeout2));
        req.on("error", () => clearTimeout(timeout2));
        req.on("abort", () => clearTimeout(timeout2));
      } else {
        req.setTimeout(options.timeout);
      }
    }
    if (options.isChromiumNetwork) {
      req.removeHeader("Content-Length");
    }
    if (options.data) {
      if (typeof options.data === "string") {
        req.write(options.data);
      }
    }
    req.end();
    const cancellationListener = token.onCancellationRequested(() => {
      cancellationListener.dispose();
      req.abort();
      reject(new CancellationError());
    });
    req.on("response", () => cancellationListener.dispose());
    req.on("error", () => cancellationListener.dispose());
  });
}
export {
  RequestService,
  lookupKerberosAuthorization,
  nodeRequest
};
