import { Queue } from "../../../../base/common/async.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { URL } from "url";
import { promises as fs } from "fs";
function resolveOtlpTracesEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = "/v1/traces";
      return url.toString();
    }
    return endpoint;
  } catch {
    return endpoint;
  }
}
class OtlpHttpForwarder extends Disposable {
  constructor(_options, _logService, _fetchFn) {
    super();
    this._options = _options;
    this._logService = _logService;
    this._fetchFn = _fetchFn;
    this._queue = new Queue();
    this._disposed = false;
    this._resolvedEndpoint = resolveOtlpTracesEndpoint(_options.endpoint);
    this._register(toDisposable(() => {
      this._disposed = true;
    }));
  }
  forwardRaw(body, contentType) {
    if (this._disposed) {
      return;
    }
    void this._queue.queue(() => this._sendOnce(body, contentType));
  }
  async flush() {
    try {
      await this._queue.queue(() => Promise.resolve());
    } catch {
    }
  }
  async _sendOnce(body, contentType) {
    try {
      if (this._fetchFn) {
        const response = await this._fetchFn(this._resolvedEndpoint, {
          method: "POST",
          headers: {
            "content-type": contentType,
            "content-length": String(body.length),
            ...this._options.headers ?? {}
          },
          body: Uint8Array.from(body).buffer,
          signal: AbortSignal.timeout(this._options.timeoutMs ?? 1e4)
        });
        await response.arrayBuffer();
        if (!response.ok) {
          throw new Error(`upstream returned HTTP ${response.status}`);
        }
        return;
      }
      const url = new URL(this._resolvedEndpoint);
      const isHttps = url.protocol === "https:";
      const mod = isHttps ? await import("https") : await import("http");
      const headers = {
        "content-type": contentType,
        "content-length": String(body.length),
        ...this._options.headers ?? {}
      };
      await postOnce(mod, {
        host: url.hostname,
        port: url.port ? Number(url.port) : isHttps ? 443 : 80,
        path: url.pathname + (url.search ?? ""),
        method: "POST",
        headers,
        timeoutMs: this._options.timeoutMs ?? 1e4
      }, body);
    } catch (err) {
      this._logService.warn(`[agentHost-otel] forward to ${this._resolvedEndpoint} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
function postOnce(mod, options, body) {
  return new Promise((resolve, reject) => {
    const req = mod.request({
      host: options.host,
      port: options.port,
      path: options.path,
      method: options.method,
      headers: options.headers,
      timeout: options.timeoutMs
    });
    const onError = (err) => {
      req.destroy();
      reject(err);
    };
    req.on("error", onError);
    req.on("timeout", () => onError(new Error(`request timeout after ${options.timeoutMs}ms`)));
    req.on("response", (res) => {
      res.resume();
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        if (status >= 200 && status < 300) {
          resolve();
        } else {
          reject(new Error(`upstream returned HTTP ${status}`));
        }
      });
      res.on("error", onError);
    });
    req.end(body);
  });
}
class FileForwarder extends Disposable {
  constructor(_options, _logService) {
    super();
    this._options = _options;
    this._logService = _logService;
    this._queue = new Queue();
    this._disposed = false;
    this._register(toDisposable(() => {
      this._disposed = true;
    }));
  }
  forwardSpans(result) {
    if (this._disposed || result.spans.length === 0) {
      return;
    }
    const lines = result.spans.map((s) => JSON.stringify(s)).join("\n") + "\n";
    void this._queue.queue(() => this._append(lines));
  }
  async flush() {
    try {
      await this._queue.queue(() => Promise.resolve());
    } catch {
    }
  }
  async _append(lines) {
    try {
      await fs.appendFile(this._options.filePath, lines, { encoding: "utf8" });
    } catch (err) {
      this._logService.warn(`[agentHost-otel] file forward to ${this._options.filePath} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
class ConsoleForwarder extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._disposed = false;
    this._register(toDisposable(() => {
      this._disposed = true;
    }));
  }
  forwardSpans(result) {
    if (this._disposed) {
      return;
    }
    for (const span of result.spans) {
      this._logService.info(`[agentHost-otel] span ${formatSpan(span)}`);
    }
  }
  async flush() {
  }
}
function formatSpan(s) {
  const duration = Math.max(0, s.endTime - s.startTime);
  const op = s.attributes["gen_ai.operation.name"];
  const model = s.attributes["gen_ai.request.model"] ?? s.attributes["gen_ai.response.model"];
  const tail = [op && `op=${op}`, model && `model=${model}`].filter(Boolean).join(" ");
  return `${s.name} (${duration}ms) trace=${s.traceId} span=${s.spanId}${tail ? " " + tail : ""}`;
}
class CompositeForwarder extends Disposable {
  constructor(children) {
    super();
    this._children = children;
    for (const c of children) {
      this._register(c);
    }
  }
  forwardRaw(body, contentType) {
    for (const c of this._children) {
      c.forwardRaw?.(body, contentType);
    }
  }
  forwardSpans(result) {
    for (const c of this._children) {
      c.forwardSpans?.(result);
    }
  }
  async flush() {
    await Promise.all(this._children.map((c) => c.flush()));
  }
}
export {
  CompositeForwarder,
  ConsoleForwarder,
  FileForwarder,
  OtlpHttpForwarder,
  resolveOtlpTracesEndpoint
};
