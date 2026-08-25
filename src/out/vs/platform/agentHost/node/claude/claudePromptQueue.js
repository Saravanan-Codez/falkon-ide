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
import { DeferredPromise } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../log/common/log.js";
let ClaudePromptQueue = class extends Disposable {
  constructor(_sessionId, _getAbortSignal, _onSteeringYielded, _logService) {
    super();
    this._sessionId = _sessionId;
    this._getAbortSignal = _getAbortSignal;
    this._onSteeringYielded = _onSteeringYielded;
    this._logService = _logService;
    this._toYield = [];
    this._yielded = [];
    /**
     * Entries that have been popped by {@link settleHead} during the
     * current turn but whose deferreds haven't been completed yet — we
     * batch-complete them when the turn fully drains so an intermediate
     * `result` (steering preempt; CONTEXT.md M10) does NOT settle the
     * original `sendMessage`'s deferred.
     */
    this._popped = [];
    this._pendingPromptDeferred = new DeferredPromise();
    this.iterable = {
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          while (true) {
            if (this._getAbortSignal().aborted) {
              return { done: true, value: void 0 };
            }
            if (this._toYield.length > 0) {
              const entry = this._toYield.shift();
              this._yielded.push(entry);
              this._logService.info(`[Claude:${this._sessionId}] queue yielded sdkUuid=${entry.sdkUuid} turnId=${entry.turnId}${entry.steeringPendingId ? ` steeringPendingId=${entry.steeringPendingId}` : ""}`);
              if (entry.steeringPendingId) {
                this._onSteeringYielded(entry.steeringPendingId);
              }
              return { done: false, value: entry.sdkMessage };
            }
            await this._pendingPromptDeferred.p;
            this._pendingPromptDeferred = new DeferredPromise();
          }
        }
      })
    };
  }
  /** True iff no entries are queued or in-flight. */
  get isEmpty() {
    return this._toYield.length === 0 && this._yielded.length === 0;
  }
  /**
   * Push an entry. Resolves with the entry's deferred (which the
   * consumer settles on `result` via {@link settleHead}).
   */
  push(entry) {
    this._toYield.push(entry);
    this._pendingPromptDeferred.complete();
    return entry.deferred.p;
  }
  /**
   * Most-recent in-flight or queued entry, used by steering to inherit
   * its parent's `turnId`. Prefers the in-flight head over the latest
   * queued entry (matches CONTEXT.md M10: steering folds into the
   * in-progress protocol Turn).
   */
  peekParent() {
    return this._yielded[0] ?? this._toYield[this._toYield.length - 1];
  }
  /**
   * Pop the head of the yielded list. If the queue is now fully
   * drained (no more pending or in-flight entries), batch-complete
   * every popped-but-deferred deferred from this turn including the
   * one we just popped. Otherwise hold the popped entry's deferred
   * until the turn ends — the M10 invariant for steering preempt.
   * Called by the consumer on every `result` message.
   */
  settleHead() {
    const completed = this._yielded.shift();
    if (!completed) {
      return void 0;
    }
    if (this.isEmpty) {
      completed.deferred.complete();
      for (const e of this._popped) {
        if (!e.deferred.isSettled) {
          e.deferred.complete();
        }
      }
      this._popped = [];
    } else {
      this._popped.push(completed);
    }
    return completed;
  }
  /** Reject every pending deferred with `err` and clear all lists. */
  failAll(err) {
    const rejectAll = (list) => {
      for (const entry of list) {
        if (!entry.deferred.isSettled) {
          entry.deferred.error(err);
        }
      }
    };
    rejectAll(this._toYield);
    rejectAll(this._yielded);
    rejectAll(this._popped);
    this._toYield = [];
    this._yielded = [];
    this._popped = [];
  }
  /** Wake any parked `next()` — call after the controller is aborted so the iterable returns `done`. */
  notifyAborted() {
    this._pendingPromptDeferred.complete();
  }
  /** Re-create the parked deferred for a fresh Query binding. */
  resetForRebind() {
    this._pendingPromptDeferred = new DeferredPromise();
  }
};
ClaudePromptQueue = __decorateClass([
  __decorateParam(3, ILogService)
], ClaudePromptQueue);
export {
  ClaudePromptQueue
};
