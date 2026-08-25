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
import { Disposable, toDisposable } from "../../base/common/lifecycle.js";
import { createDecorator } from "../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../platform/log/common/log.js";
const IServerLifetimeService = createDecorator("serverLifetimeService");
const SHUTDOWN_TIMEOUT = 5 * 60 * 1e3;
let ServerLifetimeService = class extends Disposable {
  constructor(_options, _logService) {
    super();
    this._options = _options;
    this._logService = _logService;
    this._consumers = /* @__PURE__ */ new Map();
    this._totalCount = 0;
    if (this._options.enableAutoShutdown) {
      this._scheduleShutdown(true);
    }
  }
  get hasActiveConsumers() {
    return this._totalCount > 0;
  }
  active(consumer) {
    const wasEmpty = this._totalCount === 0;
    const current = this._consumers.get(consumer) ?? 0;
    this._consumers.set(consumer, current + 1);
    this._totalCount++;
    this._logService.debug(`ServerLifetime: consumer '${consumer}' active (total: ${this._totalCount})`);
    if (wasEmpty) {
      this._cancelShutdown();
    }
    let disposed = false;
    return toDisposable(() => {
      if (disposed) {
        return;
      }
      disposed = true;
      const count = this._consumers.get(consumer);
      if (count !== void 0) {
        if (count <= 1) {
          this._consumers.delete(consumer);
        } else {
          this._consumers.set(consumer, count - 1);
        }
      }
      this._totalCount--;
      this._logService.debug(`ServerLifetime: consumer '${consumer}' inactive (total: ${this._totalCount})`);
      if (this._totalCount === 0 && this._options.enableAutoShutdown) {
        this._scheduleShutdown(false);
      }
    });
  }
  delay() {
    if (this._shutdownTimer) {
      this._logService.debug("ServerLifetime: delay requested, resetting shutdown timer");
      this._cancelShutdown();
      this._scheduleShutdown(false);
    }
  }
  _scheduleShutdown(initial) {
    if (this._options.shutdownWithoutDelay && !initial) {
      this._tryShutdown();
    } else {
      this._logService.debug("ServerLifetime: scheduling shutdown timer");
      this._shutdownTimer = setTimeout(() => {
        this._shutdownTimer = void 0;
        this._tryShutdown();
      }, SHUTDOWN_TIMEOUT);
    }
  }
  _tryShutdown() {
    if (this._totalCount > 0) {
      this._logService.debug("ServerLifetime: consumer became active, aborting shutdown");
      return;
    }
    console.log("All consumers inactive, shutting down");
    this._logService.info("ServerLifetime: all consumers inactive, shutting down");
    this.dispose();
    process.exit(0);
  }
  _cancelShutdown() {
    if (this._shutdownTimer) {
      this._logService.debug("ServerLifetime: cancelling shutdown timer");
      clearTimeout(this._shutdownTimer);
      this._shutdownTimer = void 0;
    }
  }
};
ServerLifetimeService = __decorateClass([
  __decorateParam(1, ILogService)
], ServerLifetimeService);
export {
  IServerLifetimeService,
  SHUTDOWN_TIMEOUT,
  ServerLifetimeService
};
