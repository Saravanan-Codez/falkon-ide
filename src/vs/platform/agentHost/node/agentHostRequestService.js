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
import { newWriteableBufferStream, VSBuffer } from "../../../base/common/buffer.js";
import { timeout } from "../../../base/common/async.js";
import { CancellationError, isCancellationError } from "../../../base/common/errors.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { ILogService } from "../../log/common/log.js";
import { RequestService } from "../../request/node/requestService.js";
import { IAgentHostProxyResolver } from "./agentHostProxyResolver.js";
const TRANSIENT_ERROR_CODES = /* @__PURE__ */ new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "EPROTO"
]);
const IDEMPOTENT_HTTP_METHODS_REGEX = /^(GET|HEAD|OPTIONS)$/i;
function isTransientError(error) {
  if (error instanceof Error) {
    const code = error.code;
    return !!code && TRANSIENT_ERROR_CODES.has(code);
  }
  return false;
}
let AgentHostRequestService = class extends RequestService {
  constructor(configurationService, environmentService, logService, _proxyResolver) {
    super("local", configurationService, environmentService, logService);
    this._proxyResolver = _proxyResolver;
  }
  request(options, token) {
    return this.logAndRequest(options, () => this._request(options, token));
  }
  resolveProxy(url) {
    return this._proxyResolver.resolveProxy(url);
  }
  async _request(options, token) {
    const maxRetries = 3;
    let lastError;
    const isIdempotent = IDEMPOTENT_HTTP_METHODS_REGEX.test(options.type || "GET");
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this._requestAttempt(options, token);
      } catch (error) {
        lastError = error;
        if (isCancellationError(error)) {
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
  async _requestAttempt(options, token) {
    if (token.isCancellationRequested) {
      throw new CancellationError();
    }
    const cancellation = new AbortController();
    const cancellationListener = token.onCancellationRequested(() => cancellation.abort());
    const signal = options.timeout ? AbortSignal.any([cancellation.signal, AbortSignal.timeout(options.timeout)]) : cancellation.signal;
    try {
      const response = await this._proxyResolver.fetch(options.url || "", {
        method: options.type || "GET",
        headers: getRequestHeaders(options),
        body: options.data,
        signal,
        cache: options.disableCache ? "no-store" : void 0
      });
      const stream = response.body ? responseBodyToStream(response.body, cancellation, cancellationListener) : emptyResponseStream(cancellationListener);
      return {
        res: {
          statusCode: response.status,
          headers: getResponseHeaders(response)
        },
        stream
      };
    } catch (error) {
      cancellationListener.dispose();
      if (error instanceof Error && error.name === "AbortError") {
        throw new CancellationError();
      }
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`Fetch timeout: ${options.timeout}ms`);
      }
      throw error;
    }
  }
};
AgentHostRequestService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, INativeEnvironmentService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IAgentHostProxyResolver)
], AgentHostRequestService);
function getRequestHeaders(options) {
  if (!options.headers && !options.user && !options.password && !options.proxyAuthorization) {
    return void 0;
  }
  const headers = new Headers();
  for (const key in options.headers) {
    const value = options.headers[key];
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    }
  }
  if (options.user || options.password) {
    headers.set("Authorization", `Basic ${btoa(`${options.user || ""}:${options.password || ""}`)}`);
  }
  if (options.proxyAuthorization) {
    headers.set("Proxy-Authorization", options.proxyAuthorization);
  }
  return headers;
}
function getResponseHeaders(response) {
  const headers = /* @__PURE__ */ Object.create(null);
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}
function emptyResponseStream(cancellationListener) {
  const stream = newWriteableBufferStream();
  stream.end();
  cancellationListener.dispose();
  return stream;
}
function responseBodyToStream(body, cancellation, cancellationListener) {
  const reader = body.getReader();
  const stream = newWriteableBufferStream({ highWaterMark: 16 });
  const destroy = stream.destroy.bind(stream);
  stream.destroy = () => {
    cancellation.abort();
    void reader.cancel();
    cancellationListener.dispose();
    destroy();
  };
  void pumpResponseBody(reader, stream, cancellationListener);
  return stream;
}
async function pumpResponseBody(reader, stream, cancellationListener) {
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      await stream.write(VSBuffer.wrap(value));
    }
    stream.end();
  } catch (error) {
    stream.error(error instanceof Error ? error : new Error(String(error)));
    stream.end();
  } finally {
    cancellationListener.dispose();
  }
}
export {
  AgentHostRequestService
};
