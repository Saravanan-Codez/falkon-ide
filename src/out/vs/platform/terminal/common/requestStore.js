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
import { timeout } from "../../../base/common/async.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, dispose, toDisposable } from "../../../base/common/lifecycle.js";
import { ILogService } from "../../log/common/log.js";
let RequestStore = class extends Disposable {
  /**
   * @param timeout How long in ms to allow requests to go unanswered for, undefined will use the
   * default (15 seconds).
   */
  constructor(timeout2, _logService) {
    super();
    this._logService = _logService;
    this._lastRequestId = 0;
    this._pendingRequests = /* @__PURE__ */ new Map();
    this._pendingRequestDisposables = /* @__PURE__ */ new Map();
    this._onCreateRequest = this._register(new Emitter());
    this.onCreateRequest = this._onCreateRequest.event;
    this._timeout = timeout2 === void 0 ? 15e3 : timeout2;
    this._register(toDisposable(() => {
      for (const d of this._pendingRequestDisposables.values()) {
        dispose(d);
      }
    }));
  }
  /**
   * Creates a request.
   * @param args The arguments to pass to the onCreateRequest event.
   */
  createRequest(args) {
    return new Promise((resolve, reject) => {
      const requestId = ++this._lastRequestId;
      this._pendingRequests.set(requestId, resolve);
      this._onCreateRequest.fire({ requestId, ...args });
      const tokenSource = new CancellationTokenSource();
      timeout(this._timeout, tokenSource.token).then(() => reject(`Request ${requestId} timed out (${this._timeout}ms)`));
      this._pendingRequestDisposables.set(requestId, [toDisposable(() => tokenSource.cancel())]);
    });
  }
  /**
   * Accept a reply to a request.
   * @param requestId The request ID originating from the onCreateRequest event.
   * @param data The reply data.
   */
  acceptReply(requestId, data) {
    const resolveRequest = this._pendingRequests.get(requestId);
    if (resolveRequest) {
      this._pendingRequests.delete(requestId);
      dispose(this._pendingRequestDisposables.get(requestId) || []);
      this._pendingRequestDisposables.delete(requestId);
      resolveRequest(data);
    } else {
      this._logService.warn(`RequestStore#acceptReply was called without receiving a matching request ${requestId}`);
    }
  }
};
RequestStore = __decorateClass([
  __decorateParam(1, ILogService)
], RequestStore);
export {
  RequestStore
};
