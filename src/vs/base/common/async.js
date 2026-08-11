import { CancellationTokenSource } from "./cancellation.js";
import { BugIndicatingError, CancellationError, isCancellationError } from "./errors.js";
import { Emitter, Event } from "./event.js";
import { Disposable, DisposableMap, isDisposable, MutableDisposable, toDisposable } from "./lifecycle.js";
import { extUri as defaultExtUri } from "./resources.js";
import { setTimeout0 } from "./platform.js";
import { MicrotaskDelay } from "./symbols.js";
import { Lazy } from "./lazy.js";
function isThenable(obj) {
  return !!obj && typeof obj.then === "function";
}
function createCancelablePromise(callback) {
  const source = new CancellationTokenSource();
  const thenable = callback(source.token);
  let isCancelled = false;
  const promise = new Promise((resolve, reject) => {
    const subscription = source.token.onCancellationRequested(() => {
      isCancelled = true;
      subscription.dispose();
      reject(new CancellationError());
    });
    Promise.resolve(thenable).then((value) => {
      subscription.dispose();
      source.dispose();
      if (!isCancelled) {
        resolve(value);
      } else if (isDisposable(value)) {
        value.dispose();
      }
    }, (err) => {
      subscription.dispose();
      source.dispose();
      reject(err);
    });
  });
  return new class {
    cancel() {
      source.cancel();
      source.dispose();
    }
    then(resolve, reject) {
      return promise.then(resolve, reject);
    }
    catch(reject) {
      return this.then(void 0, reject);
    }
    finally(onfinally) {
      return promise.finally(onfinally);
    }
  }();
}
function raceCancellation(promise, token, defaultValue) {
  return new Promise((resolve, reject) => {
    const ref = token.onCancellationRequested(() => {
      ref.dispose();
      resolve(defaultValue);
    });
    promise.then(resolve, reject).finally(() => ref.dispose());
  });
}
function raceCancellationError(promise, token) {
  return new Promise((resolve, reject) => {
    const ref = token.onCancellationRequested(() => {
      ref.dispose();
      reject(new CancellationError());
    });
    promise.then(resolve, reject).finally(() => ref.dispose());
  });
}
function rejectIfNotCanceled(err) {
  if (isCancellationError(err)) {
    return void 0;
  }
  return Promise.reject(err);
}
function notCancellablePromise(promise) {
  return new Promise((resolve, reject) => {
    promise.then(resolve, reject);
  });
}
function raceCancellablePromises(cancellablePromises) {
  let resolvedPromiseIndex = -1;
  const promises = cancellablePromises.map((promise2, index) => promise2.then((result) => {
    resolvedPromiseIndex = index;
    return result;
  }));
  const promise = Promise.race(promises);
  promise.cancel = () => {
    cancellablePromises.forEach((cancellablePromise, index) => {
      if (index !== resolvedPromiseIndex && cancellablePromise.cancel) {
        cancellablePromise.cancel();
      }
    });
  };
  promise.finally(() => {
    promise.cancel();
  });
  return promise;
}
function raceTimeout(promise, timeout2, onTimeout) {
  let promiseResolve = void 0;
  const timer = setTimeout(() => {
    promiseResolve?.(void 0);
    onTimeout?.();
  }, timeout2);
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => promiseResolve = resolve)
  ]);
}
function asPromise(callback) {
  return new Promise((resolve, reject) => {
    const item = callback();
    if (isThenable(item)) {
      item.then(resolve, reject);
    } else {
      resolve(item);
    }
  });
}
function promiseWithResolvers() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
class Throttler {
  constructor() {
    this.activePromise = null;
    this.queuedPromise = null;
    this.queuedPromiseFactory = null;
    this.cancellationTokenSource = new CancellationTokenSource();
  }
  queue(promiseFactory) {
    if (this.cancellationTokenSource.token.isCancellationRequested) {
      return Promise.reject(new Error("Throttler is disposed"));
    }
    if (this.activePromise) {
      this.queuedPromiseFactory = promiseFactory;
      if (!this.queuedPromise) {
        const onComplete = () => {
          this.queuedPromise = null;
          if (this.cancellationTokenSource.token.isCancellationRequested) {
            return;
          }
          const result = this.queue(this.queuedPromiseFactory);
          this.queuedPromiseFactory = null;
          return result;
        };
        this.queuedPromise = new Promise((resolve) => {
          this.activePromise.then(onComplete, onComplete).then(resolve);
        });
      }
      return new Promise((resolve, reject) => {
        this.queuedPromise.then(resolve, reject);
      });
    }
    this.activePromise = promiseFactory(this.cancellationTokenSource.token);
    return new Promise((resolve, reject) => {
      this.activePromise.then((result) => {
        this.activePromise = null;
        resolve(result);
      }, (err) => {
        this.activePromise = null;
        reject(err);
      });
    });
  }
  dispose() {
    this.cancellationTokenSource.cancel();
  }
}
class Sequencer {
  constructor() {
    this.current = Promise.resolve(null);
  }
  queue(promiseTask) {
    return this.current = this.current.then(() => promiseTask(), () => promiseTask());
  }
}
class ThrottlerByKey {
  constructor() {
    this.throttlers = /* @__PURE__ */ new Map();
  }
  queue(key, task) {
    let entry = this.throttlers.get(key);
    if (!entry) {
      entry = { throttler: new Throttler(), count: 0 };
      this.throttlers.set(key, entry);
    }
    entry.count++;
    return entry.throttler.queue(task).finally(() => {
      if (--entry.count === 0) {
        entry.throttler.dispose();
        this.throttlers.delete(key);
      }
    });
  }
  dispose() {
    for (const { throttler } of this.throttlers.values()) {
      throttler.dispose();
    }
    this.throttlers.clear();
  }
}
class SequencerByKey {
  constructor() {
    this.promiseMap = /* @__PURE__ */ new Map();
  }
  queue(key, promiseTask) {
    const runningPromise = this.promiseMap.get(key) ?? Promise.resolve();
    const newPromise = runningPromise.catch(() => {
    }).then(promiseTask).finally(() => {
      if (this.promiseMap.get(key) === newPromise) {
        this.promiseMap.delete(key);
      }
    });
    this.promiseMap.set(key, newPromise);
    return newPromise;
  }
  peek(key) {
    return this.promiseMap.get(key) || void 0;
  }
  keys() {
    return this.promiseMap.keys();
  }
}
const timeoutDeferred = (timeout2, fn) => {
  let scheduled = true;
  const handle = setTimeout(() => {
    scheduled = false;
    fn();
  }, timeout2);
  return {
    isTriggered: () => scheduled,
    dispose: () => {
      clearTimeout(handle);
      scheduled = false;
    }
  };
};
const microtaskDeferred = (fn) => {
  let scheduled = true;
  queueMicrotask(() => {
    if (scheduled) {
      scheduled = false;
      fn();
    }
  });
  return {
    isTriggered: () => scheduled,
    dispose: () => {
      scheduled = false;
    }
  };
};
class Delayer {
  constructor(defaultDelay) {
    this.defaultDelay = defaultDelay;
    this.deferred = null;
    this.completionPromise = null;
    this.doResolve = null;
    this.doReject = null;
    this.task = null;
  }
  trigger(task, delay = this.defaultDelay) {
    this.task = task;
    this.cancelTimeout();
    if (!this.completionPromise) {
      this.completionPromise = new Promise((resolve, reject) => {
        this.doResolve = resolve;
        this.doReject = reject;
      }).then(() => {
        this.completionPromise = null;
        this.doResolve = null;
        if (this.task) {
          const task2 = this.task;
          this.task = null;
          return task2();
        }
        return void 0;
      });
    }
    const fn = () => {
      this.deferred = null;
      this.doResolve?.(null);
    };
    this.deferred = delay === MicrotaskDelay ? microtaskDeferred(fn) : timeoutDeferred(delay, fn);
    return this.completionPromise;
  }
  isTriggered() {
    return !!this.deferred?.isTriggered();
  }
  cancel() {
    this.cancelTimeout();
    if (this.completionPromise) {
      this.doReject?.(new CancellationError());
      this.completionPromise = null;
    }
  }
  cancelTimeout() {
    this.deferred?.dispose();
    this.deferred = null;
  }
  dispose() {
    this.cancel();
  }
}
class ThrottledDelayer {
  constructor(defaultDelay) {
    this.delayer = new Delayer(defaultDelay);
    this.throttler = new Throttler();
  }
  trigger(promiseFactory, delay) {
    return this.delayer.trigger(() => this.throttler.queue(promiseFactory), delay);
  }
  isTriggered() {
    return this.delayer.isTriggered();
  }
  cancel() {
    this.delayer.cancel();
  }
  dispose() {
    this.delayer.dispose();
    this.throttler.dispose();
  }
}
class Barrier {
  constructor() {
    this._isOpen = false;
    this._promise = new Promise((c, e) => {
      this._completePromise = c;
    });
  }
  isOpen() {
    return this._isOpen;
  }
  open() {
    this._isOpen = true;
    this._completePromise(true);
  }
  wait() {
    return this._promise;
  }
}
class AutoOpenBarrier extends Barrier {
  constructor(autoOpenTimeMs) {
    super();
    this._timeout = setTimeout(() => this.open(), autoOpenTimeMs);
  }
  open() {
    clearTimeout(this._timeout);
    super.open();
  }
}
function timeout(millis, token) {
  if (!token) {
    return createCancelablePromise((token2) => timeout(millis, token2));
  }
  return new Promise((resolve, reject) => {
    const handle = setTimeout(() => {
      disposable.dispose();
      resolve();
    }, millis);
    const disposable = token.onCancellationRequested(() => {
      clearTimeout(handle);
      disposable.dispose();
      reject(new CancellationError());
    });
  });
}
function disposableTimeout(handler, timeout2 = 0, store) {
  const timer = setTimeout(() => {
    handler();
    if (store) {
      disposable.dispose();
    }
  }, timeout2);
  const disposable = toDisposable(() => {
    clearTimeout(timer);
    store?.delete(disposable);
  });
  store?.add(disposable);
  return disposable;
}
const MAX_TIMEOUT_DELAY = 2 ** 31 - 1;
function disposableLongTimeout(handler, timeout2, store) {
  const target = Date.now() + timeout2;
  let timer;
  const arm = () => {
    const remaining = target - Date.now();
    if (remaining <= 0) {
      handler();
      if (store) {
        disposable.dispose();
      }
      return;
    }
    timer = setTimeout(arm, Math.min(remaining, MAX_TIMEOUT_DELAY));
  };
  const disposable = toDisposable(() => {
    clearTimeout(timer);
    store?.delete(disposable);
  });
  timer = setTimeout(arm, Math.min(Math.max(0, timeout2), MAX_TIMEOUT_DELAY));
  store?.add(disposable);
  return disposable;
}
function sequence(promiseFactories) {
  const results = [];
  let index = 0;
  const len = promiseFactories.length;
  function next() {
    return index < len ? promiseFactories[index++]() : null;
  }
  function thenHandler(result) {
    if (result !== void 0 && result !== null) {
      results.push(result);
    }
    const n = next();
    if (n) {
      return n.then(thenHandler);
    }
    return Promise.resolve(results);
  }
  return Promise.resolve(null).then(thenHandler);
}
function first(promiseFactories, shouldStop = (t) => !!t, defaultValue = null) {
  let index = 0;
  const len = promiseFactories.length;
  const loop = () => {
    if (index >= len) {
      return Promise.resolve(defaultValue);
    }
    const factory = promiseFactories[index++];
    const promise = Promise.resolve(factory());
    return promise.then((result) => {
      if (shouldStop(result)) {
        return Promise.resolve(result);
      }
      return loop();
    });
  };
  return loop();
}
function firstParallel(promiseList, shouldStop = (t) => !!t, defaultValue = null) {
  if (promiseList.length === 0) {
    return Promise.resolve(defaultValue);
  }
  let todo = promiseList.length;
  const finish = () => {
    todo = -1;
    for (const promise of promiseList) {
      promise.cancel?.();
    }
  };
  return new Promise((resolve, reject) => {
    for (const promise of promiseList) {
      promise.then((result) => {
        if (--todo >= 0 && shouldStop(result)) {
          finish();
          resolve(result);
        } else if (todo === 0) {
          resolve(defaultValue);
        }
      }).catch((err) => {
        if (--todo >= 0) {
          finish();
          reject(err);
        }
      });
    }
  });
}
class Limiter {
  constructor(maxDegreeOfParalellism) {
    this._size = 0;
    this._isDisposed = false;
    this.maxDegreeOfParalellism = maxDegreeOfParalellism;
    this.outstandingPromises = [];
    this.runningPromises = 0;
    this._onDrained = new Emitter();
  }
  /**
   *
   * @returns A promise that resolved when all work is done (onDrained) or when
   * there is nothing to do
   */
  whenIdle() {
    return this.size > 0 ? Event.toPromise(this.onDrained) : Promise.resolve();
  }
  get onDrained() {
    return this._onDrained.event;
  }
  get size() {
    return this._size;
  }
  queue(factory) {
    if (this._isDisposed) {
      throw new Error("Object has been disposed");
    }
    this._size++;
    return new Promise((c, e) => {
      this.outstandingPromises.push({ factory, c, e });
      this.consume();
    });
  }
  consume() {
    while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
      const iLimitedTask = this.outstandingPromises.shift();
      this.runningPromises++;
      const promise = iLimitedTask.factory();
      promise.then(iLimitedTask.c, iLimitedTask.e);
      promise.then(() => this.consumed(), () => this.consumed());
    }
  }
  consumed() {
    if (this._isDisposed) {
      return;
    }
    this.runningPromises--;
    if (--this._size === 0) {
      this._onDrained.fire();
    }
    if (this.outstandingPromises.length > 0) {
      this.consume();
    }
  }
  clear() {
    if (this._isDisposed) {
      throw new Error("Object has been disposed");
    }
    this.outstandingPromises.length = 0;
    this._size = this.runningPromises;
  }
  dispose() {
    this._isDisposed = true;
    this.outstandingPromises.length = 0;
    this._size = 0;
    this._onDrained.dispose();
  }
}
class Queue extends Limiter {
  constructor() {
    super(1);
  }
}
class LimitedQueue {
  constructor() {
    this.sequentializer = new TaskSequentializer();
    this.tasks = 0;
  }
  queue(factory) {
    if (!this.sequentializer.isRunning()) {
      return this.sequentializer.run(this.tasks++, factory());
    }
    return this.sequentializer.queue(() => {
      return this.sequentializer.run(this.tasks++, factory());
    });
  }
}
class ResourceQueue {
  constructor() {
    this.queues = /* @__PURE__ */ new Map();
    this.drainers = /* @__PURE__ */ new Set();
    this.drainListeners = void 0;
    this.drainListenerCount = 0;
  }
  async whenDrained() {
    if (this.isDrained()) {
      return;
    }
    const promise = new DeferredPromise();
    this.drainers.add(promise);
    return promise.p;
  }
  isDrained() {
    for (const [, queue] of this.queues) {
      if (queue.size > 0) {
        return false;
      }
    }
    return true;
  }
  queueSize(resource, extUri = defaultExtUri) {
    const key = extUri.getComparisonKey(resource);
    return this.queues.get(key)?.size ?? 0;
  }
  queueFor(resource, factory, extUri = defaultExtUri) {
    const key = extUri.getComparisonKey(resource);
    let queue = this.queues.get(key);
    if (!queue) {
      queue = new Queue();
      const drainListenerId = this.drainListenerCount++;
      const drainListener = Event.once(queue.onDrained)(() => {
        queue?.dispose();
        this.queues.delete(key);
        this.onDidQueueDrain();
        this.drainListeners?.deleteAndDispose(drainListenerId);
        if (this.drainListeners?.size === 0) {
          this.drainListeners.dispose();
          this.drainListeners = void 0;
        }
      });
      if (!this.drainListeners) {
        this.drainListeners = new DisposableMap();
      }
      this.drainListeners.set(drainListenerId, drainListener);
      this.queues.set(key, queue);
    }
    return queue.queue(factory);
  }
  onDidQueueDrain() {
    if (!this.isDrained()) {
      return;
    }
    this.releaseDrainers();
  }
  releaseDrainers() {
    for (const drainer of this.drainers) {
      drainer.complete();
    }
    this.drainers.clear();
  }
  dispose() {
    for (const [, queue] of this.queues) {
      queue.dispose();
    }
    this.queues.clear();
    this.releaseDrainers();
    this.drainListeners?.dispose();
  }
}
class TaskQueue {
  constructor() {
    this._runningTask = void 0;
    this._pendingTasks = [];
  }
  /**
   * Waits for the current and pending tasks to finish, then runs and awaits the given task.
   * If the task is skipped because of clearPending, the promise is rejected with a CancellationError.
  */
  schedule(task) {
    const deferred = new DeferredPromise();
    this._pendingTasks.push({ task, deferred, setUndefinedWhenCleared: false });
    this._runIfNotRunning();
    return deferred.p;
  }
  /**
   * Waits for the current and pending tasks to finish, then runs and awaits the given task.
   * If the task is skipped because of clearPending, the promise is resolved with undefined.
  */
  scheduleSkipIfCleared(task) {
    const deferred = new DeferredPromise();
    this._pendingTasks.push({ task, deferred, setUndefinedWhenCleared: true });
    this._runIfNotRunning();
    return deferred.p;
  }
  _runIfNotRunning() {
    if (this._runningTask === void 0) {
      this._processQueue();
    }
  }
  async _processQueue() {
    if (this._pendingTasks.length === 0) {
      return;
    }
    const next = this._pendingTasks.shift();
    if (!next) {
      return;
    }
    if (this._runningTask) {
      throw new BugIndicatingError();
    }
    this._runningTask = next.task;
    try {
      const result = await next.task();
      next.deferred.complete(result);
    } catch (e) {
      next.deferred.error(e);
    } finally {
      this._runningTask = void 0;
      this._processQueue();
    }
  }
  /**
   * Clears all pending tasks. Does not cancel the currently running task.
  */
  clearPending() {
    const tasks = this._pendingTasks;
    this._pendingTasks = [];
    for (const task of tasks) {
      if (task.setUndefinedWhenCleared) {
        task.deferred.complete(void 0);
      } else {
        task.deferred.error(new CancellationError());
      }
    }
  }
}
class TimeoutTimer {
  constructor(runner, timeout2) {
    this._isDisposed = false;
    this._token = void 0;
    if (typeof runner === "function" && typeof timeout2 === "number") {
      this.setIfNotSet(runner, timeout2);
    }
  }
  dispose() {
    this.cancel();
    this._isDisposed = true;
  }
  cancel() {
    if (this._token !== void 0) {
      clearTimeout(this._token);
      this._token = void 0;
    }
  }
  cancelAndSet(runner, timeout2) {
    if (this._isDisposed) {
      throw new BugIndicatingError(`Calling 'cancelAndSet' on a disposed TimeoutTimer`);
    }
    this.cancel();
    this._token = setTimeout(() => {
      this._token = void 0;
      runner();
    }, timeout2);
  }
  setIfNotSet(runner, timeout2) {
    if (this._isDisposed) {
      throw new BugIndicatingError(`Calling 'setIfNotSet' on a disposed TimeoutTimer`);
    }
    if (this._token !== void 0) {
      return;
    }
    this._token = setTimeout(() => {
      this._token = void 0;
      runner();
    }, timeout2);
  }
}
class IntervalTimer {
  constructor() {
    this.disposable = void 0;
    this.isDisposed = false;
  }
  cancel() {
    this.disposable?.dispose();
    this.disposable = void 0;
  }
  cancelAndSet(runner, interval, context = globalThis) {
    if (this.isDisposed) {
      throw new BugIndicatingError(`Calling 'cancelAndSet' on a disposed IntervalTimer`);
    }
    this.cancel();
    const handle = context.setInterval(() => {
      runner();
    }, interval);
    this.disposable = toDisposable(() => {
      context.clearInterval(handle);
      this.disposable = void 0;
    });
  }
  dispose() {
    this.cancel();
    this.isDisposed = true;
  }
}
class RunOnceScheduler {
  constructor(runner, delay) {
    this.timeoutToken = void 0;
    this.runner = runner;
    this.timeout = delay;
    this.timeoutHandler = this.onTimeout.bind(this);
  }
  /**
   * Dispose RunOnceScheduler
   */
  dispose() {
    this.cancel();
    this.runner = null;
  }
  /**
   * Cancel current scheduled runner (if any).
   */
  cancel() {
    if (this.isScheduled()) {
      clearTimeout(this.timeoutToken);
      this.timeoutToken = void 0;
    }
  }
  /**
   * Cancel previous runner (if any) & schedule a new runner.
   */
  schedule(delay = this.timeout) {
    this.cancel();
    this.timeoutToken = setTimeout(this.timeoutHandler, delay);
  }
  get delay() {
    return this.timeout;
  }
  set delay(value) {
    this.timeout = value;
  }
  /**
   * Returns true if scheduled.
   */
  isScheduled() {
    return this.timeoutToken !== void 0;
  }
  flush() {
    if (this.isScheduled()) {
      this.cancel();
      this.doRun();
    }
  }
  onTimeout() {
    this.timeoutToken = void 0;
    if (this.runner) {
      this.doRun();
    }
  }
  doRun() {
    this.runner?.();
  }
}
class ProcessTimeRunOnceScheduler {
  constructor(runner, delay) {
    if (delay % 1e3 !== 0) {
      console.warn(`ProcessTimeRunOnceScheduler resolution is 1s, ${delay}ms is not a multiple of 1000ms.`);
    }
    this.runner = runner;
    this.timeout = delay;
    this.counter = 0;
    this.intervalToken = void 0;
    this.intervalHandler = this.onInterval.bind(this);
  }
  dispose() {
    this.cancel();
    this.runner = null;
  }
  cancel() {
    if (this.isScheduled()) {
      clearInterval(this.intervalToken);
      this.intervalToken = void 0;
    }
  }
  /**
   * Cancel previous runner (if any) & schedule a new runner.
   */
  schedule(delay = this.timeout) {
    if (delay % 1e3 !== 0) {
      console.warn(`ProcessTimeRunOnceScheduler resolution is 1s, ${delay}ms is not a multiple of 1000ms.`);
    }
    this.cancel();
    this.counter = Math.ceil(delay / 1e3);
    this.intervalToken = setInterval(this.intervalHandler, 1e3);
  }
  /**
   * Returns true if scheduled.
   */
  isScheduled() {
    return this.intervalToken !== void 0;
  }
  onInterval() {
    this.counter--;
    if (this.counter > 0) {
      return;
    }
    clearInterval(this.intervalToken);
    this.intervalToken = void 0;
    this.runner?.();
  }
}
class RunOnceWorker extends RunOnceScheduler {
  constructor(runner, timeout2) {
    super(runner, timeout2);
    this.units = [];
  }
  work(unit) {
    this.units.push(unit);
    if (!this.isScheduled()) {
      this.schedule();
    }
  }
  doRun() {
    const units = this.units;
    this.units = [];
    this.runner?.(units);
  }
  dispose() {
    this.units = [];
    super.dispose();
  }
}
class ThrottledWorker extends Disposable {
  constructor(options, handler) {
    super();
    this.options = options;
    this.handler = handler;
    this.pendingWork = [];
    this.throttler = this._register(new MutableDisposable());
    this.disposed = false;
    this.lastExecutionTime = 0;
  }
  /**
   * The number of work units that are pending to be processed.
   */
  get pending() {
    return this.pendingWork.length;
  }
  /**
   * Add units to be worked on. Use `pending` to figure out
   * how many units are not yet processed after this method
   * was called.
   *
   * @returns whether the work was accepted or not. If the
   * worker is disposed, it will not accept any more work.
   * If the number of pending units would become larger
   * than `maxPendingWork`, more work will also not be accepted.
   */
  work(units) {
    if (this.disposed) {
      return false;
    }
    if (typeof this.options.maxBufferedWork === "number") {
      if (this.throttler.value) {
        if (this.pending + units.length > this.options.maxBufferedWork) {
          return false;
        }
      } else {
        if (this.pending + units.length - this.options.maxWorkChunkSize > this.options.maxBufferedWork) {
          return false;
        }
      }
    }
    for (const unit of units) {
      this.pendingWork.push(unit);
    }
    const timeSinceLastExecution = Date.now() - this.lastExecutionTime;
    if (!this.throttler.value && (!this.options.waitThrottleDelayBetweenWorkUnits || timeSinceLastExecution >= this.options.throttleDelay)) {
      this.doWork();
    } else if (!this.throttler.value && this.options.waitThrottleDelayBetweenWorkUnits) {
      this.scheduleThrottler(Math.max(this.options.throttleDelay - timeSinceLastExecution, 0));
    } else {
    }
    return true;
  }
  doWork() {
    this.lastExecutionTime = Date.now();
    this.handler(this.pendingWork.splice(0, this.options.maxWorkChunkSize));
    if (this.pendingWork.length > 0) {
      this.scheduleThrottler();
    }
  }
  scheduleThrottler(delay = this.options.throttleDelay) {
    this.throttler.value = new RunOnceScheduler(() => {
      this.throttler.clear();
      this.doWork();
    }, delay);
    this.throttler.value.schedule();
  }
  dispose() {
    super.dispose();
    this.pendingWork.length = 0;
    this.disposed = true;
  }
}
let runWhenGlobalIdle;
let _runWhenIdle;
(function() {
  const safeGlobal = globalThis;
  if (typeof safeGlobal.requestIdleCallback !== "function" || typeof safeGlobal.cancelIdleCallback !== "function") {
    _runWhenIdle = (_targetWindow, runner, timeout2) => {
      setTimeout0(() => {
        if (disposed) {
          return;
        }
        const end = Date.now() + 15;
        const deadline = {
          didTimeout: true,
          timeRemaining() {
            return Math.max(0, end - Date.now());
          }
        };
        runner(Object.freeze(deadline));
      });
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
        }
      };
    };
  } else {
    _runWhenIdle = (targetWindow, runner, timeout2) => {
      const handle = targetWindow.requestIdleCallback(runner, typeof timeout2 === "number" ? { timeout: timeout2 } : void 0);
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
          targetWindow.cancelIdleCallback(handle);
        }
      };
    };
  }
  runWhenGlobalIdle = (runner, timeout2) => _runWhenIdle(globalThis, runner, timeout2);
})();
function installFakeRunWhenIdle(fakeImpl) {
  const origRunWhenIdle = _runWhenIdle;
  const origRunWhenGlobalIdle = runWhenGlobalIdle;
  _runWhenIdle = fakeImpl;
  runWhenGlobalIdle = (runner, timeout2) => fakeImpl(globalThis, runner, timeout2);
  return toDisposable(() => {
    _runWhenIdle = origRunWhenIdle;
    runWhenGlobalIdle = origRunWhenGlobalIdle;
  });
}
class AbstractIdleValue {
  constructor(targetWindow, executor) {
    this._didRun = false;
    this._executor = () => {
      try {
        this._value = executor();
      } catch (err) {
        this._error = err;
      } finally {
        this._didRun = true;
      }
    };
    this._handle = _runWhenIdle(targetWindow, () => this._executor());
  }
  dispose() {
    this._handle.dispose();
  }
  get value() {
    if (!this._didRun) {
      this._handle.dispose();
      this._executor();
    }
    if (this._error) {
      throw this._error;
    }
    return this._value;
  }
  get isInitialized() {
    return this._didRun;
  }
}
class GlobalIdleValue extends AbstractIdleValue {
  constructor(executor) {
    super(globalThis, executor);
  }
}
async function retry(task, delay, retries) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await timeout(delay);
    }
  }
  throw lastError;
}
class TaskSequentializer {
  isRunning(taskId) {
    if (typeof taskId === "number") {
      return this._running?.taskId === taskId;
    }
    return !!this._running;
  }
  get running() {
    return this._running?.promise;
  }
  cancelRunning() {
    this._running?.cancel();
  }
  run(taskId, promise, onCancel) {
    this._running = { taskId, cancel: () => onCancel?.(), promise };
    promise.then(() => this.doneRunning(taskId), () => this.doneRunning(taskId));
    return promise;
  }
  doneRunning(taskId) {
    if (this._running && taskId === this._running.taskId) {
      this._running = void 0;
      this.runQueued();
    }
  }
  runQueued() {
    if (this._queued) {
      const queued = this._queued;
      this._queued = void 0;
      queued.run().then(queued.promiseResolve, queued.promiseReject);
    }
  }
  /**
   * Note: the promise to schedule as next run MUST itself call `run`.
   *       Otherwise, this sequentializer will report `false` for `isRunning`
   *       even when this task is running. Missing this detail means that
   *       suddenly multiple tasks will run in parallel.
   */
  queue(run) {
    if (!this._queued) {
      const { promise, resolve: promiseResolve, reject: promiseReject } = promiseWithResolvers();
      this._queued = {
        run,
        promise,
        promiseResolve,
        promiseReject
      };
    } else {
      this._queued.run = run;
    }
    return this._queued.promise;
  }
  hasQueued() {
    return !!this._queued;
  }
  async join() {
    return this._queued?.promise ?? this._running?.promise;
  }
}
class IntervalCounter {
  constructor(interval, nowFn = () => Date.now()) {
    this.interval = interval;
    this.nowFn = nowFn;
    this.lastIncrementTime = 0;
    this.value = 0;
  }
  increment() {
    const now = this.nowFn();
    if (now - this.lastIncrementTime > this.interval) {
      this.lastIncrementTime = now;
      this.value = 0;
    }
    this.value++;
    return this.value;
  }
}
var DeferredOutcome = /* @__PURE__ */ ((DeferredOutcome2) => {
  DeferredOutcome2[DeferredOutcome2["Resolved"] = 0] = "Resolved";
  DeferredOutcome2[DeferredOutcome2["Rejected"] = 1] = "Rejected";
  return DeferredOutcome2;
})(DeferredOutcome || {});
class DeferredPromise {
  static fromPromise(promise) {
    const deferred = new DeferredPromise();
    deferred.settleWith(promise);
    return deferred;
  }
  get isRejected() {
    return this.outcome?.outcome === 1 /* Rejected */;
  }
  get isResolved() {
    return this.outcome?.outcome === 0 /* Resolved */;
  }
  get isSettled() {
    return !!this.outcome;
  }
  get value() {
    return this.outcome?.outcome === 0 /* Resolved */ ? this.outcome?.value : void 0;
  }
  constructor() {
    this.p = new Promise((c, e) => {
      this.completeCallback = c;
      this.errorCallback = e;
    });
  }
  complete(value) {
    if (this.isSettled) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.completeCallback(value);
      this.outcome = { outcome: 0 /* Resolved */, value };
      resolve();
    });
  }
  error(err) {
    if (this.isSettled) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.errorCallback(err);
      this.outcome = { outcome: 1 /* Rejected */, value: err };
      resolve();
    });
  }
  settleWith(promise) {
    return promise.then(
      (value) => this.complete(value),
      (error) => this.error(error)
    );
  }
  cancel() {
    return this.error(new CancellationError());
  }
}
var Promises;
((Promises2) => {
  async function settled(promises) {
    let firstError = void 0;
    const result = await Promise.all(promises.map((promise) => promise.then((value) => value, (error) => {
      if (!firstError) {
        firstError = error;
      }
      return void 0;
    })));
    if (typeof firstError !== "undefined") {
      throw firstError;
    }
    return result;
  }
  Promises2.settled = settled;
  function withAsyncBody(bodyFn) {
    return new Promise(async (resolve, reject) => {
      try {
        await bodyFn(resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }
  Promises2.withAsyncBody = withAsyncBody;
})(Promises || (Promises = {}));
class StatefulPromise {
  constructor(promise) {
    this._value = void 0;
    this._error = void 0;
    this._isResolved = false;
    this.promise = promise.then(
      (value) => {
        this._value = value;
        this._isResolved = true;
        return value;
      },
      (error) => {
        this._error = error;
        this._isResolved = true;
        throw error;
      }
    );
  }
  get value() {
    return this._value;
  }
  get error() {
    return this._error;
  }
  get isResolved() {
    return this._isResolved;
  }
  /**
   * Returns the resolved value.
   * Throws if the promise is not resolved yet.
   */
  requireValue() {
    if (!this._isResolved) {
      throw new BugIndicatingError("Promise is not resolved yet");
    }
    if (this._error) {
      throw this._error;
    }
    return this._value;
  }
}
class LazyStatefulPromise {
  constructor(_compute) {
    this._compute = _compute;
    this._promise = new Lazy(() => new StatefulPromise(this._compute()));
  }
  /**
   * Returns the resolved value.
   * Throws if the promise is not resolved yet.
   */
  requireValue() {
    return this._promise.value.requireValue();
  }
  /**
   * Returns the promise (and triggers a computation of the promise if not yet done so).
   */
  getPromise() {
    return this._promise.value.promise;
  }
  /**
   * Reads the current value without triggering a computation of the promise.
   */
  get currentValue() {
    return this._promise.rawValue?.value;
  }
}
var AsyncIterableSourceState = /* @__PURE__ */ ((AsyncIterableSourceState2) => {
  AsyncIterableSourceState2[AsyncIterableSourceState2["Initial"] = 0] = "Initial";
  AsyncIterableSourceState2[AsyncIterableSourceState2["DoneOK"] = 1] = "DoneOK";
  AsyncIterableSourceState2[AsyncIterableSourceState2["DoneError"] = 2] = "DoneError";
  return AsyncIterableSourceState2;
})(AsyncIterableSourceState || {});
class AsyncIterableObject {
  static fromArray(items) {
    return new AsyncIterableObject((writer) => {
      writer.emitMany(items);
    });
  }
  static fromPromise(promise) {
    return new AsyncIterableObject(async (emitter) => {
      emitter.emitMany(await promise);
    });
  }
  static fromPromisesResolveOrder(promises) {
    return new AsyncIterableObject(async (emitter) => {
      await Promise.all(promises.map(async (p) => emitter.emitOne(await p)));
    });
  }
  static merge(iterables) {
    return new AsyncIterableObject(async (emitter) => {
      await Promise.all(iterables.map(async (iterable) => {
        for await (const item of iterable) {
          emitter.emitOne(item);
        }
      }));
    });
  }
  static {
    this.EMPTY = AsyncIterableObject.fromArray([]);
  }
  constructor(executor, onReturn) {
    this._state = 0 /* Initial */;
    this._results = [];
    this._error = null;
    this._onReturn = onReturn;
    this._onStateChanged = new Emitter();
    queueMicrotask(async () => {
      const writer = {
        emitOne: (item) => this.emitOne(item),
        emitMany: (items) => this.emitMany(items),
        reject: (error) => this.reject(error)
      };
      try {
        await Promise.resolve(executor(writer));
        this.resolve();
      } catch (err) {
        this.reject(err);
      } finally {
        writer.emitOne = () => {
        };
        writer.emitMany = () => {
        };
        writer.reject = () => {
        };
      }
    });
  }
  [Symbol.asyncIterator]() {
    let i = 0;
    return {
      next: async () => {
        do {
          if (this._state === 2 /* DoneError */) {
            throw this._error;
          }
          if (i < this._results.length) {
            return { done: false, value: this._results[i++] };
          }
          if (this._state === 1 /* DoneOK */) {
            return { done: true, value: void 0 };
          }
          await Event.toPromise(this._onStateChanged.event);
        } while (true);
      },
      return: async () => {
        this._onReturn?.();
        return { done: true, value: void 0 };
      }
    };
  }
  static map(iterable, mapFn) {
    return new AsyncIterableObject(async (emitter) => {
      for await (const item of iterable) {
        emitter.emitOne(mapFn(item));
      }
    });
  }
  map(mapFn) {
    return AsyncIterableObject.map(this, mapFn);
  }
  static filter(iterable, filterFn) {
    return new AsyncIterableObject(async (emitter) => {
      for await (const item of iterable) {
        if (filterFn(item)) {
          emitter.emitOne(item);
        }
      }
    });
  }
  filter(filterFn) {
    return AsyncIterableObject.filter(this, filterFn);
  }
  static coalesce(iterable) {
    return AsyncIterableObject.filter(iterable, (item) => !!item);
  }
  coalesce() {
    return AsyncIterableObject.coalesce(this);
  }
  static async toPromise(iterable) {
    const result = [];
    for await (const item of iterable) {
      result.push(item);
    }
    return result;
  }
  toPromise() {
    return AsyncIterableObject.toPromise(this);
  }
  /**
   * The value will be appended at the end.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  emitOne(value) {
    if (this._state !== 0 /* Initial */) {
      return;
    }
    this._results.push(value);
    this._onStateChanged.fire();
  }
  /**
   * The values will be appended at the end.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  emitMany(values) {
    if (this._state !== 0 /* Initial */) {
      return;
    }
    this._results = this._results.concat(values);
    this._onStateChanged.fire();
  }
  /**
   * Calling `resolve()` will mark the result array as complete.
   *
   * **NOTE** `resolve()` must be called, otherwise all consumers of this iterable will hang indefinitely, similar to a non-resolved promise.
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  resolve() {
    if (this._state !== 0 /* Initial */) {
      return;
    }
    this._state = 1 /* DoneOK */;
    this._onStateChanged.fire();
  }
  /**
   * Writing an error will permanently invalidate this iterable.
   * The current users will receive an error thrown, as will all future users.
   *
   * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
   */
  reject(error) {
    if (this._state !== 0 /* Initial */) {
      return;
    }
    this._state = 2 /* DoneError */;
    this._error = error;
    this._onStateChanged.fire();
  }
}
function createCancelableAsyncIterableProducer(callback) {
  const source = new CancellationTokenSource();
  const innerIterable = callback(source.token);
  return new CancelableAsyncIterableProducer(source, async (emitter) => {
    const subscription = source.token.onCancellationRequested(() => {
      subscription.dispose();
      source.dispose();
      emitter.reject(new CancellationError());
    });
    try {
      for await (const item of innerIterable) {
        if (source.token.isCancellationRequested) {
          return;
        }
        emitter.emitOne(item);
      }
      subscription.dispose();
      source.dispose();
    } catch (err) {
      subscription.dispose();
      source.dispose();
      emitter.reject(err);
    }
  });
}
class AsyncIterableSource {
  /**
   *
   * @param onReturn A function that will be called when consuming the async iterable
   * has finished by the consumer, e.g the for-await-loop has be existed (break, return) early.
   * This is NOT called when resolving this source by its owner.
   */
  constructor(onReturn) {
    this._deferred = new DeferredPromise();
    this._asyncIterable = new AsyncIterableObject((emitter) => {
      if (earlyError) {
        emitter.reject(earlyError);
        return;
      }
      if (earlyItems) {
        emitter.emitMany(earlyItems);
      }
      this._errorFn = (error) => emitter.reject(error);
      this._emitOneFn = (item) => emitter.emitOne(item);
      this._emitManyFn = (items) => emitter.emitMany(items);
      return this._deferred.p;
    }, onReturn);
    let earlyError;
    let earlyItems;
    this._errorFn = (error) => {
      if (!earlyError) {
        earlyError = error;
      }
    };
    this._emitOneFn = (item) => {
      if (!earlyItems) {
        earlyItems = [];
      }
      earlyItems.push(item);
    };
    this._emitManyFn = (items) => {
      if (!earlyItems) {
        earlyItems = items.slice();
      } else {
        items.forEach((item) => earlyItems.push(item));
      }
    };
  }
  get asyncIterable() {
    return this._asyncIterable;
  }
  resolve() {
    this._deferred.complete();
  }
  reject(error) {
    this._errorFn(error);
    this._deferred.complete();
  }
  emitOne(item) {
    this._emitOneFn(item);
  }
  emitMany(items) {
    this._emitManyFn(items);
  }
}
function cancellableIterable(iterableOrIterator, token) {
  const iterator = Symbol.asyncIterator in iterableOrIterator ? iterableOrIterator[Symbol.asyncIterator]() : iterableOrIterator;
  return {
    async next() {
      if (token.isCancellationRequested) {
        return { done: true, value: void 0 };
      }
      const result = await raceCancellation(iterator.next(), token);
      return result || { done: true, value: void 0 };
    },
    throw: iterator.throw?.bind(iterator),
    return: iterator.return?.bind(iterator),
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
class ProducerConsumer {
  constructor() {
    this._unsatisfiedConsumers = [];
    this._unconsumedValues = [];
  }
  get hasFinalValue() {
    return !!this._finalValue;
  }
  produce(value) {
    this._ensureNoFinalValue();
    if (this._unsatisfiedConsumers.length > 0) {
      const deferred = this._unsatisfiedConsumers.shift();
      this._resolveOrRejectDeferred(deferred, value);
    } else {
      this._unconsumedValues.push(value);
    }
  }
  produceFinal(value) {
    this._ensureNoFinalValue();
    this._finalValue = value;
    for (const deferred of this._unsatisfiedConsumers) {
      this._resolveOrRejectDeferred(deferred, value);
    }
    this._unsatisfiedConsumers.length = 0;
  }
  _ensureNoFinalValue() {
    if (this._finalValue) {
      throw new BugIndicatingError("ProducerConsumer: cannot produce after final value has been set");
    }
  }
  _resolveOrRejectDeferred(deferred, value) {
    if (value.ok) {
      deferred.complete(value.value);
    } else {
      deferred.error(value.error);
    }
  }
  consume() {
    if (this._unconsumedValues.length > 0 || this._finalValue) {
      const value = this._unconsumedValues.length > 0 ? this._unconsumedValues.shift() : this._finalValue;
      if (value.ok) {
        return Promise.resolve(value.value);
      } else {
        return Promise.reject(value.error);
      }
    } else {
      const deferred = new DeferredPromise();
      this._unsatisfiedConsumers.push(deferred);
      return deferred.p;
    }
  }
}
class AsyncIterableProducer {
  constructor(executor, _onReturn) {
    this._onReturn = _onReturn;
    this._producerConsumer = new ProducerConsumer();
    this._iterator = {
      next: () => this._producerConsumer.consume(),
      return: () => {
        this._onReturn?.();
        return Promise.resolve({ done: true, value: void 0 });
      },
      throw: async (e) => {
        this._finishError(e);
        return { done: true, value: void 0 };
      }
    };
    queueMicrotask(async () => {
      const p = executor({
        emitOne: (value) => this._producerConsumer.produce({ ok: true, value: { done: false, value } }),
        emitMany: (values) => {
          for (const value of values) {
            this._producerConsumer.produce({ ok: true, value: { done: false, value } });
          }
        },
        reject: (error) => this._finishError(error)
      });
      if (!this._producerConsumer.hasFinalValue) {
        try {
          await p;
          this._finishOk();
        } catch (error) {
          this._finishError(error);
        }
      }
    });
  }
  static fromArray(items) {
    return new AsyncIterableProducer((writer) => {
      writer.emitMany(items);
    });
  }
  static fromPromise(promise) {
    return new AsyncIterableProducer(async (emitter) => {
      emitter.emitMany(await promise);
    });
  }
  static fromPromisesResolveOrder(promises) {
    return new AsyncIterableProducer(async (emitter) => {
      await Promise.all(promises.map(async (p) => emitter.emitOne(await p)));
    });
  }
  static merge(iterables) {
    return new AsyncIterableProducer(async (emitter) => {
      await Promise.all(iterables.map(async (iterable) => {
        for await (const item of iterable) {
          emitter.emitOne(item);
        }
      }));
    });
  }
  static {
    this.EMPTY = AsyncIterableProducer.fromArray([]);
  }
  static map(iterable, mapFn) {
    return new AsyncIterableProducer(async (emitter) => {
      for await (const item of iterable) {
        emitter.emitOne(mapFn(item));
      }
    });
  }
  static tee(iterable) {
    let emitter1;
    let emitter2;
    const defer = new DeferredPromise();
    const start = async () => {
      if (!emitter1 || !emitter2) {
        return;
      }
      try {
        for await (const item of iterable) {
          emitter1.emitOne(item);
          emitter2.emitOne(item);
        }
      } catch (err) {
        emitter1.reject(err);
        emitter2.reject(err);
      } finally {
        defer.complete();
      }
    };
    const p1 = new AsyncIterableProducer(async (emitter) => {
      emitter1 = emitter;
      start();
      return defer.p;
    });
    const p2 = new AsyncIterableProducer(async (emitter) => {
      emitter2 = emitter;
      start();
      return defer.p;
    });
    return [p1, p2];
  }
  map(mapFn) {
    return AsyncIterableProducer.map(this, mapFn);
  }
  static coalesce(iterable) {
    return AsyncIterableProducer.filter(iterable, (item) => !!item);
  }
  coalesce() {
    return AsyncIterableProducer.coalesce(this);
  }
  static filter(iterable, filterFn) {
    return new AsyncIterableProducer(async (emitter) => {
      for await (const item of iterable) {
        if (filterFn(item)) {
          emitter.emitOne(item);
        }
      }
    });
  }
  filter(filterFn) {
    return AsyncIterableProducer.filter(this, filterFn);
  }
  _finishOk() {
    if (!this._producerConsumer.hasFinalValue) {
      this._producerConsumer.produceFinal({ ok: true, value: { done: true, value: void 0 } });
    }
  }
  _finishError(error) {
    if (!this._producerConsumer.hasFinalValue) {
      this._producerConsumer.produceFinal({ ok: false, error });
    }
  }
  [Symbol.asyncIterator]() {
    return this._iterator;
  }
}
class CancelableAsyncIterableProducer extends AsyncIterableProducer {
  constructor(_source, executor) {
    super(executor);
    this._source = _source;
  }
  cancel() {
    this._source.cancel();
  }
}
const AsyncReaderEndOfStream = /* @__PURE__ */ Symbol("AsyncReaderEndOfStream");
class AsyncReader {
  constructor(_source) {
    this._source = _source;
    this._buffer = [];
    this._atEnd = false;
  }
  get endOfStream() {
    return this._buffer.length === 0 && this._atEnd;
  }
  async read() {
    if (this._buffer.length === 0 && !this._atEnd) {
      await this._extendBuffer();
    }
    if (this._buffer.length === 0) {
      return AsyncReaderEndOfStream;
    }
    return this._buffer.shift();
  }
  async readWhile(predicate, callback) {
    do {
      const piece = await this.peek();
      if (piece === AsyncReaderEndOfStream) {
        break;
      }
      if (!predicate(piece)) {
        break;
      }
      await this.read();
      await callback(piece);
    } while (true);
  }
  readBufferedOrThrow() {
    const value = this.peekBufferedOrThrow();
    this._buffer.shift();
    return value;
  }
  async consumeToEnd() {
    while (!this.endOfStream) {
      await this.read();
    }
  }
  async peek() {
    if (this._buffer.length === 0 && !this._atEnd) {
      await this._extendBuffer();
    }
    if (this._buffer.length === 0) {
      return AsyncReaderEndOfStream;
    }
    return this._buffer[0];
  }
  peekBufferedOrThrow() {
    if (this._buffer.length === 0) {
      if (this._atEnd) {
        return AsyncReaderEndOfStream;
      }
      throw new BugIndicatingError("No buffered elements");
    }
    return this._buffer[0];
  }
  async peekTimeout(timeoutMs) {
    if (this._buffer.length === 0 && !this._atEnd) {
      await raceTimeout(this._extendBuffer(), timeoutMs);
    }
    if (this._atEnd) {
      return AsyncReaderEndOfStream;
    }
    if (this._buffer.length === 0) {
      return void 0;
    }
    return this._buffer[0];
  }
  _extendBuffer() {
    if (this._atEnd) {
      return Promise.resolve();
    }
    if (!this._extendBufferPromise) {
      this._extendBufferPromise = (async () => {
        const { value, done } = await this._source.next();
        this._extendBufferPromise = void 0;
        if (done) {
          this._atEnd = true;
        } else {
          this._buffer.push(value);
        }
      })();
    }
    return this._extendBufferPromise;
  }
}
function createTimeout(ms, cb) {
  const t = setTimeout(cb, ms);
  return toDisposable(() => clearTimeout(t));
}
export {
  AbstractIdleValue,
  AsyncIterableObject,
  AsyncIterableProducer,
  AsyncIterableSource,
  AsyncReader,
  AsyncReaderEndOfStream,
  AutoOpenBarrier,
  Barrier,
  CancelableAsyncIterableProducer,
  DeferredPromise,
  Delayer,
  GlobalIdleValue,
  IntervalCounter,
  IntervalTimer,
  LazyStatefulPromise,
  LimitedQueue,
  Limiter,
  MAX_TIMEOUT_DELAY,
  ProcessTimeRunOnceScheduler,
  Promises,
  Queue,
  ResourceQueue,
  RunOnceScheduler,
  RunOnceWorker,
  Sequencer,
  SequencerByKey,
  StatefulPromise,
  TaskQueue,
  TaskSequentializer,
  ThrottledDelayer,
  ThrottledWorker,
  Throttler,
  ThrottlerByKey,
  TimeoutTimer,
  _runWhenIdle,
  asPromise,
  cancellableIterable,
  createCancelableAsyncIterableProducer,
  createCancelablePromise,
  createTimeout,
  disposableLongTimeout,
  disposableTimeout,
  first,
  firstParallel,
  installFakeRunWhenIdle,
  isThenable,
  notCancellablePromise,
  promiseWithResolvers,
  raceCancellablePromises,
  raceCancellation,
  raceCancellationError,
  raceTimeout,
  rejectIfNotCanceled,
  retry,
  runWhenGlobalIdle,
  sequence,
  timeout
};
