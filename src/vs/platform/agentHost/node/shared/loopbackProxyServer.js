function generateNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
function readProxyRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
class LoopbackProxyServer {
  constructor(name, _logService) {
    this.name = name;
    this._logService = _logService;
    this._disposed = false;
  }
  get isDisposed() {
    return this._disposed;
  }
  /**
   * Write the fallback "internal proxy error" response used when
   * {@link handleRequest} throws before sending headers. Subclasses may
   * override to match their wire format; the default emits a generic
   * JSON error envelope.
   */
  writeInternalError(res) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { type: "api_error", message: "Internal proxy error" } }));
  }
  /**
   * Acquire a refcounted lease on the shared runtime, binding the server
   * if it isn't running yet. Subclasses build their public handle around
   * the returned `runtime` and wire its `dispose()` to `release`.
   *
   * `seed` is forwarded to {@link createState} when this call triggers the
   * bind; for callers that join an existing bind it is ignored (the state
   * already exists), so they must apply their own value to `runtime.state`
   * afterwards if they need last-writer-wins semantics.
   *
   * Throws if the service has been disposed (including if `dispose()`
   * raced the bind).
   */
  async acquire(seed) {
    if (this._disposed) {
      throw new Error(`${this.name} has been disposed`);
    }
    const runtime = await this._ensureRuntime(seed);
    if (this._disposed || this._runtime !== runtime) {
      throw new Error(`${this.name} has been disposed`);
    }
    runtime.refcount++;
    let released = false;
    const release = () => {
      if (released) {
        return;
      }
      released = true;
      this._releaseHandle(runtime);
    };
    return { runtime, release };
  }
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._teardownRuntime();
  }
  /**
   * Returns the shared runtime, binding a new server if there isn't one
   * yet. Concurrent callers share the same in-flight bind via
   * {@link _starting}; this prevents two listeners from being created when
   * {@link acquire} is invoked twice before the first bind resolves.
   *
   * If {@link dispose} runs while the bind is in flight, the just-bound
   * server is torn down here and the awaiting caller sees a rejected
   * promise.
   */
  _ensureRuntime(seed) {
    if (this._runtime) {
      return Promise.resolve(this._runtime);
    }
    if (!this._starting) {
      this._starting = (async () => {
        try {
          const rt = await this._startServer(seed);
          if (this._disposed) {
            rt.server.closeAllConnections();
            rt.server.close();
            throw new Error(`${this.name} has been disposed`);
          }
          this._runtime = rt;
          return rt;
        } finally {
          this._starting = void 0;
        }
      })();
    }
    return this._starting;
  }
  _releaseHandle(runtime) {
    if (this._runtime !== runtime) {
      return;
    }
    runtime.refcount--;
    if (runtime.refcount === 0) {
      this._teardownRuntime();
    }
  }
  _teardownRuntime() {
    const runtime = this._runtime;
    if (!runtime) {
      return;
    }
    this._runtime = void 0;
    for (const entry of runtime.inFlight) {
      entry.ac.abort();
    }
    runtime.server.closeAllConnections();
    runtime.server.close((err) => {
      if (err) {
        this._logService.warn(`[${this.name}] server.close error: ${err.message}`);
      }
    });
  }
  async _startServer(seed) {
    const nonce = generateNonce();
    const inFlight = /* @__PURE__ */ new Set();
    const httpModule = await import("http");
    const server = httpModule.createServer();
    await new Promise((resolve, reject) => {
      const onError = (err) => reject(err);
      server.once("error", onError);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", onError);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error(`${this.name} failed to bind: unexpected address ${String(address)}`);
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    this._logService.info(`[${this.name}] listening on ${baseUrl}`);
    const runtime = {
      server,
      baseUrl,
      nonce,
      inFlight,
      refcount: 0,
      state: this.createState(seed)
    };
    server.on("request", (req, res) => {
      this.handleRequest(req, res, runtime).catch((err) => {
        this._logService.error(`[${this.name}] unhandled request error: ${err instanceof Error ? err.message : String(err)}`);
        if (!res.headersSent) {
          try {
            this.writeInternalError(res);
          } catch {
          }
        } else if (!res.writableEnded) {
          try {
            res.end();
          } catch {
          }
        }
      });
    });
    return runtime;
  }
}
export {
  LoopbackProxyServer,
  readProxyRequestBody
};
