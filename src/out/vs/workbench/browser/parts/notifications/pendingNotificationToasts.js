import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
class PendingNotificationToasts {
  constructor(isCurrent, equals, scheduler) {
    this.isCurrent = isCurrent;
    this.equals = equals;
    this.scheduler = scheduler;
    this.pendingToasts = /* @__PURE__ */ new Set();
  }
  tryReplace(item) {
    for (const pendingToast of this.pendingToasts) {
      if (this.equals(pendingToast.item, item)) {
        pendingToast.item = item;
        return true;
      }
    }
    return false;
  }
  add(item, render) {
    const disposables = new DisposableStore();
    const pendingToast = { item, disposables, cleanupScheduled: false };
    this.pendingToasts.add(pendingToast);
    disposables.add(toDisposable(() => this.pendingToasts.delete(pendingToast)));
    disposables.add(this.scheduler(() => {
      const pendingItem = pendingToast.item;
      if (!this.isCurrent(pendingItem)) {
        disposables.dispose();
        return;
      }
      this.pendingToasts.delete(pendingToast);
      render(pendingItem, disposables);
    }));
  }
  remove(item) {
    for (const pendingToast of this.pendingToasts) {
      if (pendingToast.item === item && !pendingToast.cleanupScheduled) {
        pendingToast.cleanupScheduled = true;
        queueMicrotask(() => {
          pendingToast.cleanupScheduled = false;
          if (this.pendingToasts.has(pendingToast) && !this.isCurrent(pendingToast.item)) {
            pendingToast.disposables.dispose();
          }
        });
        break;
      }
    }
  }
  clear() {
    for (const pendingToast of this.pendingToasts) {
      pendingToast.disposables.dispose();
    }
    this.pendingToasts.clear();
  }
  dispose() {
    this.clear();
  }
}
export {
  PendingNotificationToasts
};
