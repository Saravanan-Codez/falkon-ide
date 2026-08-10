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
import { Worker } from "worker_threads";
import { Disposable } from "../../../base/common/lifecycle.js";
import { FileAccess } from "../../../base/common/network.js";
import { ILogService } from "../../log/common/log.js";
import { DEFAULT_DIFF_TIMEOUT_MS } from "../common/diffComputeService.js";
let NodeWorkerDiffComputeService = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._workerFailures = 0;
    this._nextId = 1;
    this._pending = /* @__PURE__ */ new Map();
  }
  async computeDiffCounts(original, modified, timeoutMs = DEFAULT_DIFF_TIMEOUT_MS) {
    return this._callWorker("computeDiffCounts", original, modified, timeoutMs);
  }
  async computeDetailedDiff(original, modified, timeoutMs = DEFAULT_DIFF_TIMEOUT_MS) {
    return this._callWorker("computeDetailedDiff", original, modified, timeoutMs);
  }
  async _callWorker(functionName, original, modified, timeoutMs) {
    const worker = this._ensureWorker();
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve: (value) => resolve(value), reject });
      try {
        worker.postMessage({ id, fn: functionName, args: [original, modified, timeoutMs] });
      } catch (err) {
        this._pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  _ensureWorker() {
    if (this._workerFailures >= 3) {
      throw new Error("Diff compute worker failed too many times");
    }
    if (!this._worker) {
      const workerPath = FileAccess.asFileUri("vs/platform/agentHost/node/diffWorkerMain.js").fsPath;
      const w = new Worker(workerPath, { name: "Diff compute worker" });
      w.on("message", (msg) => {
        const handler = this._pending.get(msg.id);
        if (!handler) {
          return;
        }
        this._pending.delete(msg.id);
        if (msg.err) {
          const error = new Error(msg.err.message);
          if (msg.err.stack) {
            error.stack = msg.err.stack;
          }
          handler.reject(error);
        } else {
          handler.resolve(msg.res);
        }
      });
      w.on("error", (err) => {
        this._logService.error("[DiffComputeService] Worker error", err);
        for (const [, handler] of this._pending) {
          handler.reject(err);
        }
        this._pending.clear();
        this._worker = void 0;
        this._workerFailures++;
      });
      this._worker = w;
    }
    return this._worker;
  }
  dispose() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = void 0;
    }
    for (const [, handler] of this._pending) {
      handler.reject(new Error("DiffComputeService disposed"));
    }
    this._pending.clear();
    super.dispose();
  }
};
NodeWorkerDiffComputeService = __decorateClass([
  __decorateParam(0, ILogService)
], NodeWorkerDiffComputeService);
export {
  NodeWorkerDiffComputeService
};
