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
import { DeferredPromise } from "../../../base/common/async.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IProgressService = createDecorator("progressService");
var ProgressLocation = /* @__PURE__ */ ((ProgressLocation2) => {
  ProgressLocation2[ProgressLocation2["Explorer"] = 1] = "Explorer";
  ProgressLocation2[ProgressLocation2["Scm"] = 3] = "Scm";
  ProgressLocation2[ProgressLocation2["Extensions"] = 5] = "Extensions";
  ProgressLocation2[ProgressLocation2["Window"] = 10] = "Window";
  ProgressLocation2[ProgressLocation2["Notification"] = 15] = "Notification";
  ProgressLocation2[ProgressLocation2["Dialog"] = 20] = "Dialog";
  return ProgressLocation2;
})(ProgressLocation || {});
const emptyProgressRunner = Object.freeze({
  total() {
  },
  worked() {
  },
  done() {
  }
});
class Progress {
  constructor(callback) {
    this.callback = callback;
  }
  static {
    this.None = Object.freeze({ report() {
    } });
  }
  get value() {
    return this._value;
  }
  report(item) {
    this._value = item;
    this.callback(this._value);
  }
}
let UnmanagedProgress = class extends Disposable {
  constructor(options, progressService) {
    super();
    this.deferred = new DeferredPromise();
    progressService.withProgress(options, (reporter) => {
      this.reporter = reporter;
      if (this.lastStep) {
        reporter.report(this.lastStep);
      }
      return this.deferred.p;
    });
    this._register(toDisposable(() => this.deferred.complete()));
  }
  report(step) {
    if (this.reporter) {
      this.reporter.report(step);
    } else {
      this.lastStep = step;
    }
  }
};
UnmanagedProgress = __decorateClass([
  __decorateParam(1, IProgressService)
], UnmanagedProgress);
class LongRunningOperation extends Disposable {
  constructor(progressIndicator) {
    super();
    this.progressIndicator = progressIndicator;
    this.currentOperationId = 0;
    this.currentOperationDisposables = this._register(new DisposableStore());
    this.currentProgressTimeout = void 0;
  }
  start(progressDelay) {
    this.stop();
    const newOperationId = ++this.currentOperationId;
    const newOperationToken = new CancellationTokenSource();
    this.currentProgressTimeout = setTimeout(() => {
      if (newOperationId === this.currentOperationId) {
        this.currentProgressRunner = this.progressIndicator.show(true);
      }
    }, progressDelay);
    this.currentOperationDisposables.add(toDisposable(() => clearTimeout(this.currentProgressTimeout)));
    this.currentOperationDisposables.add(toDisposable(() => newOperationToken.cancel()));
    this.currentOperationDisposables.add(toDisposable(() => this.currentProgressRunner ? this.currentProgressRunner.done() : void 0));
    return {
      id: newOperationId,
      token: newOperationToken.token,
      stop: () => this.doStop(newOperationId),
      isCurrent: () => this.currentOperationId === newOperationId
    };
  }
  stop() {
    this.doStop(this.currentOperationId);
  }
  doStop(operationId) {
    if (this.currentOperationId === operationId) {
      this.currentOperationDisposables.clear();
    }
  }
}
const IEditorProgressService = createDecorator("editorProgressService");
export {
  IEditorProgressService,
  IProgressService,
  LongRunningOperation,
  Progress,
  ProgressLocation,
  UnmanagedProgress,
  emptyProgressRunner
};
