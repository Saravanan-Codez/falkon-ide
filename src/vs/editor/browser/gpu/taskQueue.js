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
import { getActiveWindow } from "../../../base/browser/dom.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */
let TaskQueue = class extends Disposable {
  constructor(_logService) {
    super();
    this._logService = _logService;
    this._tasks = [];
    this._i = 0;
    this._register(toDisposable(() => this.clear()));
  }
  enqueue(task) {
    this._tasks.push(task);
    this._start();
  }
  flush() {
    while (this._i < this._tasks.length) {
      if (!this._tasks[this._i]()) {
        this._i++;
      }
    }
    this.clear();
  }
  clear() {
    if (this._idleCallback) {
      this._cancelCallback(this._idleCallback);
      this._idleCallback = void 0;
    }
    this._i = 0;
    this._tasks.length = 0;
  }
  _start() {
    if (!this._idleCallback) {
      this._idleCallback = this._requestCallback(this._process.bind(this));
    }
  }
  _process(deadline) {
    this._idleCallback = void 0;
    let taskDuration = 0;
    let longestTask = 0;
    let lastDeadlineRemaining = deadline.timeRemaining();
    let deadlineRemaining = 0;
    while (this._i < this._tasks.length) {
      taskDuration = Date.now();
      if (!this._tasks[this._i]()) {
        this._i++;
      }
      taskDuration = Math.max(1, Date.now() - taskDuration);
      longestTask = Math.max(taskDuration, longestTask);
      deadlineRemaining = deadline.timeRemaining();
      if (longestTask * 1.5 > deadlineRemaining) {
        if (lastDeadlineRemaining - taskDuration < -20) {
          this._logService.warn(`task queue exceeded allotted deadline by ${Math.abs(Math.round(lastDeadlineRemaining - taskDuration))}ms`);
        }
        this._start();
        return;
      }
      lastDeadlineRemaining = deadlineRemaining;
    }
    this.clear();
  }
};
TaskQueue = __decorateClass([
  __decorateParam(0, ILogService)
], TaskQueue);
class PriorityTaskQueue extends TaskQueue {
  _requestCallback(callback) {
    return getActiveWindow().setTimeout(() => callback(this._createDeadline(16)));
  }
  _cancelCallback(identifier) {
    getActiveWindow().clearTimeout(identifier);
  }
  _createDeadline(duration) {
    const end = Date.now() + duration;
    return {
      timeRemaining: () => Math.max(0, end - Date.now())
    };
  }
}
class IdleTaskQueueInternal extends TaskQueue {
  _requestCallback(callback) {
    return getActiveWindow().requestIdleCallback(callback);
  }
  _cancelCallback(identifier) {
    getActiveWindow().cancelIdleCallback(identifier);
  }
}
const IdleTaskQueue = "requestIdleCallback" in getActiveWindow() ? IdleTaskQueueInternal : PriorityTaskQueue;
let DebouncedIdleTask = class {
  constructor(instantiationService) {
    this._queue = instantiationService.createInstance(IdleTaskQueue);
  }
  set(task) {
    this._queue.clear();
    this._queue.enqueue(task);
  }
  flush() {
    this._queue.flush();
  }
};
DebouncedIdleTask = __decorateClass([
  __decorateParam(0, IInstantiationService)
], DebouncedIdleTask);
export {
  DebouncedIdleTask,
  IdleTaskQueue,
  PriorityTaskQueue
};
