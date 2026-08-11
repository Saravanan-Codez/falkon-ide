import { CancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { hasKey } from "../../../../base/common/types.js";
var JsonRpcErrorCode = /* @__PURE__ */ ((JsonRpcErrorCode2) => {
  JsonRpcErrorCode2[JsonRpcErrorCode2["ParseError"] = -32700] = "ParseError";
  JsonRpcErrorCode2[JsonRpcErrorCode2["InvalidRequest"] = -32600] = "InvalidRequest";
  JsonRpcErrorCode2[JsonRpcErrorCode2["MethodNotFound"] = -32601] = "MethodNotFound";
  JsonRpcErrorCode2[JsonRpcErrorCode2["InvalidParams"] = -32602] = "InvalidParams";
  JsonRpcErrorCode2[JsonRpcErrorCode2["InternalError"] = -32603] = "InternalError";
  return JsonRpcErrorCode2;
})(JsonRpcErrorCode || {});
class JsonRpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = "JsonRpcError";
  }
}
const GRACE_KILL_MS = 2e3;
class CodexAppServerClient extends Disposable {
  constructor(_transport, _onLog, _graceKillMs = GRACE_KILL_MS) {
    super();
    this._transport = _transport;
    this._onLog = _onLog;
    this._graceKillMs = _graceKillMs;
    this._onExit = this._register(new Emitter());
    this.onExit = this._onExit.event;
    this._onTransportError = this._register(new Emitter());
    this.onTransportError = this._onTransportError.event;
    this._nextId = 1;
    this._pending = /* @__PURE__ */ new Map();
    this._notificationHandlers = /* @__PURE__ */ new Map();
    this._requestHandlers = /* @__PURE__ */ new Map();
    this._exited = false;
    this._disposed = false;
    this._buf = "";
    this._register(this._transport.onExit((e) => this._handleExit(e)));
    this._transport.stdout.setEncoding?.("utf8");
    this._register(this._listenToStdout());
  }
  _listenToStdout() {
    const onData = (chunk) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      this._buf += text;
      let nl;
      while ((nl = this._buf.indexOf("\n")) >= 0) {
        const line = this._buf.slice(0, nl);
        this._buf = this._buf.slice(nl + 1);
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          continue;
        }
        let parsed;
        try {
          parsed = JSON.parse(trimmed);
        } catch (err) {
          this._log("error", `parse error on line: ${trimmed.slice(0, 200)}`);
          continue;
        }
        this._dispatch(parsed);
      }
    };
    this._transport.stdout.on("data", onData);
    return toDisposable(() => this._transport.stdout.off("data", onData));
  }
  _dispatch(msg) {
    const hasId = hasKey(msg, { id: true });
    const hasMethod = hasKey(msg, { method: true });
    if (hasId && !hasMethod && (hasKey(msg, { result: true }) || hasKey(msg, { error: true }))) {
      if (typeof msg.id !== "number") {
        this._log("warn", `unsolicited response id=${msg.id}`);
        return;
      }
      const id = msg.id;
      const pending = this._pending.get(id);
      if (!pending) {
        this._log("warn", `unsolicited response id=${msg.id}`);
        return;
      }
      this._pending.delete(id);
      if (hasKey(msg, { error: true }) && msg.error) {
        pending.reject(new JsonRpcError(msg.error.code, msg.error.message, msg.error.data));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }
    if (hasMethod && hasId && msg.id !== void 0 && msg.method !== void 0) {
      void this._handleServerRequest(msg);
      return;
    }
    if (hasMethod && msg.method !== void 0) {
      this._handleServerNotification(msg);
      return;
    }
    this._log("warn", `unrecognized message: ${JSON.stringify(msg).slice(0, 200)}`);
  }
  async _handleServerRequest(msg) {
    const handler = this._requestHandlers.get(msg.method);
    if (!handler) {
      this._writeMessage({
        id: msg.id,
        error: {
          code: -32601 /* MethodNotFound */,
          message: `Method not found: ${msg.method}`
        }
      });
      return;
    }
    try {
      const result = await handler(msg.params);
      if (result.error) {
        this._writeMessage({ id: msg.id, error: result.error });
      } else {
        this._writeMessage({ id: msg.id, result: result.result });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._log("error", `handler for ${msg.method} threw: ${message}`);
      this._writeMessage({
        id: msg.id,
        error: { code: -32603 /* InternalError */, message }
      });
    }
  }
  _handleServerNotification(msg) {
    const handler = this._notificationHandlers.get(msg.method);
    if (!handler) {
      this._log("warn", `dropping unhandled notification: ${msg.method}`);
      return;
    }
    try {
      handler(msg.params);
    } catch (err) {
      this._log("error", `notification handler ${msg.method} threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  _writeMessage(message) {
    if (this._exited || this._disposed) {
      return false;
    }
    try {
      this._transport.stdin.write(JSON.stringify(message) + "\n");
      return true;
    } catch (err) {
      this._onTransportError.fire(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }
  _handleExit(e) {
    if (this._exited) {
      return;
    }
    this._exited = true;
    const reason = `codex app-server exited (code=${e.code}, signal=${e.signal})`;
    for (const [id, pending] of this._pending) {
      pending.reject(new JsonRpcError(-32603 /* InternalError */, `${reason}; request id=${id} (${pending.method}) aborted`));
    }
    this._pending.clear();
    this._onExit.fire(e);
  }
  request(method, params, trace) {
    if (this._disposed) {
      return Promise.reject(new CancellationError());
    }
    if (this._exited) {
      return Promise.reject(new JsonRpcError(-32603 /* InternalError */, "transport has exited"));
    }
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { method, resolve, reject });
      const ok = this._writeMessage({
        id,
        method,
        params,
        ...trace ? { trace: { traceparent: trace.traceparent, tracestate: trace.tracestate } } : {}
      });
      if (!ok) {
        this._pending.delete(id);
        reject(new JsonRpcError(-32603 /* InternalError */, "write failed; transport closed"));
      }
    });
  }
  notify(method, params) {
    const payload = { method };
    if (params !== void 0) {
      payload.params = params;
    }
    this._writeMessage(payload);
  }
  onNotification(method, handler) {
    this._notificationHandlers.set(method, handler);
    return toDisposable(() => {
      if (this._notificationHandlers.get(method) === handler) {
        this._notificationHandlers.delete(method);
      }
    });
  }
  onRequest(method, handler) {
    const wrapped = async (params) => {
      return await handler(params);
    };
    this._requestHandlers.set(method, wrapped);
    return toDisposable(() => {
      if (this._requestHandlers.get(method) === wrapped) {
        this._requestHandlers.delete(method);
      }
    });
  }
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    for (const pending of this._pending.values()) {
      pending.reject(new CancellationError());
    }
    this._pending.clear();
    try {
      this._transport.stdin.end();
    } catch {
    }
    if (!this._exited) {
      const timer = setTimeout(() => {
        try {
          this._transport.kill("SIGKILL");
        } catch {
        }
      }, this._graceKillMs);
      this._transport.onExitOnce(() => {
        clearTimeout(timer);
      });
      timer.unref?.();
    }
    super.dispose();
  }
  _log(level, message) {
    this._onLog?.(level, message);
  }
}
function transportFromChildProcess(child) {
  if (!child.stdin || !child.stdout) {
    throw new Error("Child process has no stdio pair");
  }
  return {
    stdin: child.stdin,
    stdout: child.stdout,
    kill: (signal) => child.kill(signal),
    onExit: Event.fromNodeEventEmitter(child, "exit", (code, signal) => ({ code, signal })),
    onExitOnce: (listener) => child.once("exit", (code, signal) => listener({ code, signal }))
  };
}
export {
  CodexAppServerClient,
  JsonRpcError,
  JsonRpcErrorCode,
  transportFromChildProcess
};
