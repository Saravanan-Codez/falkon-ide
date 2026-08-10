import { DeferredPromise } from "../../../../base/common/async.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
function animatePromptTyping(target, text, durationMs, scheduler) {
  if (!text || target.getValue()) {
    return {
      result: Promise.resolve({ outcome: "skipped", didWrite: false }),
      complete: () => void 0,
      dispose: () => void 0
    };
  }
  const store = new DisposableStore();
  const pendingFrame = store.add(new MutableDisposable());
  const result = new DeferredPromise();
  let expectedValue = "";
  let stopped = false;
  let didWrite = false;
  const write = (value) => {
    expectedValue = value;
    didWrite = true;
    target.setValue(value);
  };
  const stop = (outcome, completeText) => {
    if (stopped) {
      return;
    }
    if (completeText && target.getValue() === expectedValue && expectedValue !== text) {
      write(text);
    }
    stopped = true;
    store.dispose();
    result.complete({ outcome, didWrite });
  };
  store.add(target.onDidChange(() => {
    if (target.getValue() !== expectedValue) {
      stop("interrupted", false);
    }
  }));
  const animation = {
    result: result.p,
    complete: () => stop("completed", true),
    dispose: () => stop("cancelled", false)
  };
  if (durationMs <= 0) {
    write(text);
    stop("completed", false);
    return animation;
  }
  const startTime = scheduler.now();
  const step = () => {
    if (stopped) {
      return;
    }
    const progress = Math.min(1, Math.max(0, (scheduler.now() - startTime) / durationMs));
    const characterCount = Math.min(text.length, Math.max(1, Math.ceil(text.length * progress)));
    if (characterCount > expectedValue.length) {
      write(text.slice(0, characterCount));
    }
    if (characterCount < text.length) {
      pendingFrame.value = scheduler.schedule(step);
    } else {
      stop("completed", false);
    }
  };
  pendingFrame.value = scheduler.schedule(step);
  return animation;
}
export {
  animatePromptTyping
};
