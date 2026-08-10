import { Emitter } from "../../../../base/common/event.js";
import { timeout } from "../../../../base/common/async.js";
import { localize } from "../../../../nls.js";
class AbstractDebugAdapter {
  constructor() {
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.pendingRequestTimers = /* @__PURE__ */ new Map();
    this.queue = [];
    this._onError = new Emitter();
    this._onExit = new Emitter();
    this.sequence = 1;
  }
  get onError() {
    return this._onError.event;
  }
  get onExit() {
    return this._onExit.event;
  }
  onMessage(callback) {
    if (this.messageCallback) {
      this._onError.fire(new Error(`attempt to set more than one 'Message' callback`));
    }
    this.messageCallback = callback;
  }
  onEvent(callback) {
    if (this.eventCallback) {
      this._onError.fire(new Error(`attempt to set more than one 'Event' callback`));
    }
    this.eventCallback = callback;
  }
  onRequest(callback) {
    if (this.requestCallback) {
      this._onError.fire(new Error(`attempt to set more than one 'Request' callback`));
    }
    this.requestCallback = callback;
  }
  sendResponse(response) {
    if (response.seq > 0) {
      this._onError.fire(new Error(`attempt to send more than one response for command ${response.command}`));
    } else {
      this.internalSend("response", response);
    }
  }
  sendRequest(command, args, clb, timeout2) {
    const request = {
      command
    };
    if (args && Object.keys(args).length > 0) {
      request.arguments = args;
    }
    this.internalSend("request", request);
    if (typeof timeout2 === "number") {
      const timer = setTimeout(() => {
        this.pendingRequestTimers.delete(request.seq);
        const clb2 = this.pendingRequests.get(request.seq);
        if (clb2) {
          this.pendingRequests.delete(request.seq);
          const err = {
            type: "response",
            seq: 0,
            request_seq: request.seq,
            success: false,
            command,
            message: localize("timeout", "Timeout after {0} ms for '{1}'", timeout2, command)
          };
          clb2(err);
        }
      }, timeout2);
      this.pendingRequestTimers.set(request.seq, timer);
    }
    if (clb) {
      this.pendingRequests.set(request.seq, clb);
    }
    return request.seq;
  }
  acceptMessage(message) {
    if (this.messageCallback) {
      this.messageCallback(message);
    } else {
      this.queue.push(message);
      if (this.queue.length === 1) {
        this.processQueue();
      }
    }
  }
  /**
   * Returns whether we should insert a timeout between processing messageA
   * and messageB. Artificially queueing protocol messages guarantees that any
   * microtasks for previous message finish before next message is processed.
   * This is essential ordering when using promises anywhere along the call path.
   *
   * For example, take the following, where `chooseAndSendGreeting` returns
   * a person name and then emits a greeting event:
   *
   * ```
   * let person: string;
   * adapter.onGreeting(() => console.log('hello', person));
   * person = await adapter.chooseAndSendGreeting();
   * ```
   *
   * Because the event is dispatched synchronously, it may fire before person
   * is assigned if they're processed in the same task. Inserting a task
   * boundary avoids this issue.
   */
  needsTaskBoundaryBetween(messageA, messageB) {
    return messageA.type !== "event" || messageB.type !== "event";
  }
  /**
   * Reads and dispatches items from the queue until it is empty.
   */
  async processQueue() {
    let message;
    while (this.queue.length) {
      if (!message || this.needsTaskBoundaryBetween(this.queue[0], message)) {
        await timeout(0);
      }
      message = this.queue.shift();
      if (!message) {
        return;
      }
      switch (message.type) {
        case "event":
          this.eventCallback?.(message);
          break;
        case "request":
          this.requestCallback?.(message);
          break;
        case "response": {
          const response = message;
          const clb = this.pendingRequests.get(response.request_seq);
          if (clb) {
            this.pendingRequests.delete(response.request_seq);
            this.clearPendingRequestTimer(response.request_seq);
            clb(response);
          }
          break;
        }
      }
    }
  }
  internalSend(typ, message) {
    message.type = typ;
    message.seq = this.sequence++;
    this.sendMessage(message);
  }
  async cancelPendingRequests() {
    if (this.pendingRequests.size === 0) {
      return Promise.resolve();
    }
    const pending = /* @__PURE__ */ new Map();
    this.pendingRequests.forEach((value, key) => pending.set(key, value));
    await timeout(500);
    pending.forEach((callback, request_seq) => {
      const err = {
        type: "response",
        seq: 0,
        request_seq,
        success: false,
        command: "canceled",
        message: "canceled"
      };
      callback(err);
      this.pendingRequests.delete(request_seq);
      this.clearPendingRequestTimer(request_seq);
    });
  }
  clearPendingRequestTimer(requestSeq) {
    clearTimeout(this.pendingRequestTimers.get(requestSeq));
    this.pendingRequestTimers.delete(requestSeq);
  }
  getPendingRequestIds() {
    return Array.from(this.pendingRequests.keys());
  }
  dispose() {
    for (const timer of this.pendingRequestTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingRequestTimers.clear();
    this._onError.dispose();
    this._onExit.dispose();
    this.queue = [];
  }
}
export {
  AbstractDebugAdapter
};
