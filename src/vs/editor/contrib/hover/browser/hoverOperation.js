import { createCancelableAsyncIterableProducer, RunOnceScheduler } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
var HoverOperationState = /* @__PURE__ */ ((HoverOperationState2) => {
  HoverOperationState2[HoverOperationState2["Idle"] = 0] = "Idle";
  HoverOperationState2[HoverOperationState2["FirstWait"] = 1] = "FirstWait";
  HoverOperationState2[HoverOperationState2["SecondWait"] = 2] = "SecondWait";
  HoverOperationState2[HoverOperationState2["WaitingForAsync"] = 3] = "WaitingForAsync";
  HoverOperationState2[HoverOperationState2["WaitingForAsyncShowingLoading"] = 4] = "WaitingForAsyncShowingLoading";
  return HoverOperationState2;
})(HoverOperationState || {});
var HoverStartMode = /* @__PURE__ */ ((HoverStartMode2) => {
  HoverStartMode2[HoverStartMode2["Delayed"] = 0] = "Delayed";
  HoverStartMode2[HoverStartMode2["Immediate"] = 1] = "Immediate";
  return HoverStartMode2;
})(HoverStartMode || {});
var HoverStartSource = /* @__PURE__ */ ((HoverStartSource2) => {
  HoverStartSource2[HoverStartSource2["Mouse"] = 0] = "Mouse";
  HoverStartSource2[HoverStartSource2["Click"] = 1] = "Click";
  HoverStartSource2[HoverStartSource2["Keyboard"] = 2] = "Keyboard";
  return HoverStartSource2;
})(HoverStartSource || {});
class HoverResult {
  constructor(value, isComplete, hasLoadingMessage, options) {
    this.value = value;
    this.isComplete = isComplete;
    this.hasLoadingMessage = hasLoadingMessage;
    this.options = options;
  }
}
class HoverOperation extends Disposable {
  constructor(_editor, _computer) {
    super();
    this._editor = _editor;
    this._computer = _computer;
    this._onResult = this._register(new Emitter());
    this.onResult = this._onResult.event;
    this._asyncComputationScheduler = this._register(new Debouncer((options) => this._triggerAsyncComputation(options), 0));
    this._syncComputationScheduler = this._register(new Debouncer((options) => this._triggerSyncComputation(options), 0));
    this._loadingMessageScheduler = this._register(new Debouncer((options) => this._triggerLoadingMessage(options), 0));
    this._state = 0 /* Idle */;
    this._asyncIterable = null;
    this._asyncIterableDone = false;
    this._result = [];
  }
  dispose() {
    if (this._asyncIterable) {
      this._asyncIterable.cancel();
      this._asyncIterable = null;
    }
    this._options = void 0;
    super.dispose();
  }
  get _hoverTime() {
    return this._editor.getOption(EditorOption.hover).delay;
  }
  get _firstWaitTime() {
    return this._hoverTime / 2;
  }
  get _secondWaitTime() {
    return this._hoverTime - this._firstWaitTime;
  }
  get _loadingMessageTime() {
    return 3 * this._hoverTime;
  }
  _setState(state, options) {
    this._options = options;
    this._state = state;
    this._fireResult(options);
  }
  _triggerAsyncComputation(options) {
    this._setState(2 /* SecondWait */, options);
    this._syncComputationScheduler.schedule(options, this._secondWaitTime);
    if (this._computer.computeAsync) {
      this._asyncIterableDone = false;
      this._asyncIterable = createCancelableAsyncIterableProducer((token) => this._computer.computeAsync(options, token));
      (async () => {
        try {
          for await (const item of this._asyncIterable) {
            if (item) {
              this._result.push(item);
              this._fireResult(options);
            }
          }
          this._asyncIterableDone = true;
          if (this._state === 3 /* WaitingForAsync */ || this._state === 4 /* WaitingForAsyncShowingLoading */) {
            this._setState(0 /* Idle */, options);
          }
        } catch (e) {
          onUnexpectedError(e);
        }
      })();
    } else {
      this._asyncIterableDone = true;
    }
  }
  _triggerSyncComputation(options) {
    if (this._computer.computeSync) {
      this._result = this._result.concat(this._computer.computeSync(options));
    }
    this._setState(this._asyncIterableDone ? 0 /* Idle */ : 3 /* WaitingForAsync */, options);
  }
  _triggerLoadingMessage(options) {
    if (this._state === 3 /* WaitingForAsync */) {
      this._setState(4 /* WaitingForAsyncShowingLoading */, options);
    }
  }
  _fireResult(options) {
    if (this._state === 1 /* FirstWait */ || this._state === 2 /* SecondWait */) {
      return;
    }
    const isComplete = this._state === 0 /* Idle */;
    const hasLoadingMessage = this._state === 4 /* WaitingForAsyncShowingLoading */;
    this._onResult.fire(new HoverResult(this._result.slice(0), isComplete, hasLoadingMessage, options));
  }
  start(mode, options) {
    if (mode === 0 /* Delayed */) {
      if (this._state === 0 /* Idle */) {
        this._setState(1 /* FirstWait */, options);
        this._asyncComputationScheduler.schedule(options, this._firstWaitTime);
        this._loadingMessageScheduler.schedule(options, this._loadingMessageTime);
      }
    } else {
      switch (this._state) {
        case 0 /* Idle */:
          this._triggerAsyncComputation(options);
          this._syncComputationScheduler.cancel();
          this._triggerSyncComputation(options);
          break;
        case 2 /* SecondWait */:
          this._syncComputationScheduler.cancel();
          this._triggerSyncComputation(options);
          break;
      }
    }
  }
  cancel() {
    this._asyncComputationScheduler.cancel();
    this._syncComputationScheduler.cancel();
    this._loadingMessageScheduler.cancel();
    if (this._asyncIterable) {
      this._asyncIterable.cancel();
      this._asyncIterable = null;
    }
    this._result = [];
    this._options = void 0;
    this._state = 0 /* Idle */;
  }
  get options() {
    return this._options;
  }
}
class Debouncer extends Disposable {
  constructor(runner, debounceTimeMs) {
    super();
    this._scheduler = this._register(new RunOnceScheduler(() => runner(this._options), debounceTimeMs));
  }
  schedule(options, debounceTimeMs) {
    this._options = options;
    this._scheduler.schedule(debounceTimeMs);
  }
  cancel() {
    this._scheduler.cancel();
  }
}
export {
  HoverOperation,
  HoverResult,
  HoverStartMode,
  HoverStartSource
};
