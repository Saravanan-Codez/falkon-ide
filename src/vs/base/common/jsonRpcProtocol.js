import { DeferredPromise } from "./async.js";
import { CancellationToken, CancellationTokenSource } from "./cancellation.js";
import { CancellationError } from "./errors.js";
import { Disposable, toDisposable } from "./lifecycle.js";
import { hasKey } from "./types.js";
class JsonRpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
class JsonRpcProtocol extends Disposable {
  constructor(_send, _handlers) {
    super();
    this._send = _send;
    this._handlers = _handlers;
    this._nextRequestId = 1;
    this._pendingRequests = /* @__PURE__ */ new Map();
  }
  static {
    this.ParseError = -32700;
  }
  static {
    this.MethodNotFound = -32601;
  }
  static {
    this.InternalError = -32603;
  }
  sendNotification(notification) {
    this._send({
      jsonrpc: "2.0",
      ...notification
    });
  }
  sendRequest(request, token = CancellationToken.None, onCancel) {
    if (this._store.isDisposed) {
      return Promise.reject(new CancellationError());
    }
    const id = this._nextRequestId++;
    const promise = new DeferredPromise();
    const cts = new CancellationTokenSource();
    this._pendingRequests.set(id, { promise, cts });
    const cancelListener = token.onCancellationRequested(() => {
      if (!promise.isSettled) {
        this._pendingRequests.delete(id);
        cts.cancel();
        onCancel?.(id);
        promise.cancel();
      }
      cancelListener.dispose();
    });
    this._send({
      jsonrpc: "2.0",
      id,
      ...request
    });
    return promise.p.finally(() => {
      cancelListener.dispose();
      this._pendingRequests.delete(id);
      cts.dispose(true);
    });
  }
  /**
   * Handles one or more incoming JSON-RPC messages.
   *
   * Returns an array of JSON-RPC response objects generated for any incoming
   * requests in the message(s). Notifications and responses to our own
   * outgoing requests do not produce return values. For batch inputs, the
   * returned responses are in the same order as the corresponding requests.
   *
   * Note: responses are also emitted via the `_send` callback, so callers
   * that rely on the return value should not re-send them.
   */
  async handleMessage(message) {
    if (Array.isArray(message)) {
      const replies = [];
      for (const single of message) {
        const reply2 = await this._handleMessage(single);
        if (reply2) {
          replies.push(reply2);
        }
      }
      return replies;
    }
    const reply = await this._handleMessage(message);
    return reply ? [reply] : [];
  }
  cancelPendingRequest(id) {
    const request = this._pendingRequests.get(id);
    if (request) {
      this._pendingRequests.delete(id);
      request.cts.cancel();
      request.promise.cancel();
      request.cts.dispose(true);
    }
  }
  cancelAllRequests() {
    for (const [id, pending] of this._pendingRequests) {
      this._pendingRequests.delete(id);
      pending.cts.cancel();
      pending.promise.cancel();
      pending.cts.dispose(true);
    }
  }
  async _handleMessage(message) {
    if (isJsonRpcResponse(message)) {
      if (hasKey(message, { result: true })) {
        this._handleResult(message);
      } else {
        this._handleError(message);
      }
      return void 0;
    }
    if (isJsonRpcRequest(message)) {
      return this._handleRequest(message);
    }
    if (isJsonRpcNotification(message)) {
      this._handlers.handleNotification?.(message);
    }
    return void 0;
  }
  _handleResult(response) {
    const request = this._pendingRequests.get(response.id);
    if (request) {
      this._pendingRequests.delete(response.id);
      request.promise.complete(response.result);
      request.cts.dispose(true);
    }
  }
  _handleError(response) {
    if (response.id === void 0) {
      return;
    }
    const request = this._pendingRequests.get(response.id);
    if (request) {
      this._pendingRequests.delete(response.id);
      request.promise.error(new JsonRpcError(response.error.code, response.error.message, response.error.data));
      request.cts.dispose(true);
    }
  }
  async _handleRequest(request) {
    if (!this._handlers.handleRequest) {
      const response = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: JsonRpcProtocol.MethodNotFound,
          message: `Method not found: ${request.method}`
        }
      };
      this._send(response);
      return response;
    }
    const cts = new CancellationTokenSource();
    this._register(toDisposable(() => cts.dispose(true)));
    try {
      const resultOrThenable = this._handlers.handleRequest(request, cts.token);
      const result = isThenable(resultOrThenable) ? await resultOrThenable : resultOrThenable;
      const response = {
        jsonrpc: "2.0",
        id: request.id,
        result
      };
      this._send(response);
      return response;
    } catch (error) {
      let response;
      if (error instanceof JsonRpcError) {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: error.code,
            message: error.message,
            data: error.data
          }
        };
      } else {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: JsonRpcProtocol.InternalError,
            message: error instanceof Error ? error.message : "Internal error"
          }
        };
      }
      this._send(response);
      return response;
    } finally {
      cts.dispose(true);
    }
  }
  dispose() {
    this.cancelAllRequests();
    super.dispose();
  }
  static createParseError(message, data) {
    return {
      jsonrpc: "2.0",
      error: {
        code: JsonRpcProtocol.ParseError,
        message,
        data
      }
    };
  }
}
function isJsonRpcRequest(message) {
  return "method" in message && "id" in message && (typeof message.id === "string" || typeof message.id === "number");
}
function isJsonRpcResponse(message) {
  return hasKey(message, { id: true, result: true }) || hasKey(message, { id: true, error: true });
}
function isJsonRpcNotification(message) {
  return hasKey(message, { method: true }) && !hasKey(message, { id: true });
}
function isThenable(value) {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function";
}
export {
  JsonRpcError,
  JsonRpcProtocol,
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse
};
