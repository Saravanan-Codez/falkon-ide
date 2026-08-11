import { status } from "../../../../../base/browser/ui/aria/aria.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { CodiconActionViewItem } from "../../../notebook/browser/view/cellParts/cellActionView.js";
const forkIconClasses = ThemeIcon.asClassNameArray(Codicon.repoForked);
const spinnerIconClasses = ThemeIcon.asClassNameArray(ThemeIcon.modify(Codicon.loading, "spin"));
const labelIconClasses = [.../* @__PURE__ */ new Set([...forkIconClasses, ...spinnerIconClasses])].filter((className) => className !== "codicon");
class ChatForkActionViewItem extends CodiconActionViewItem {
  constructor() {
    super(...arguments);
    this.actionRunnerListener = this._register(new MutableDisposable());
    this.running = false;
  }
  get actionRunner() {
    return super.actionRunner;
  }
  set actionRunner(actionRunner) {
    super.actionRunner = actionRunner;
    this.bindActionRunner(actionRunner);
  }
  render(container) {
    super.render(container);
    if (this.label) {
      this.label.textContent = "";
      this.icon = document.createElement("span");
      this.icon.classList.add("chat-fork-action-icon");
      this.icon.setAttribute("aria-hidden", "true");
      this.label.appendChild(this.icon);
    }
    this.bindActionRunner(super.actionRunner);
    this.renderRunningState();
  }
  getTooltip() {
    return this.running ? localize("chat.forkConversation.running", "Forking conversation") : super.getTooltip();
  }
  updateClass() {
    super.updateClass();
    this.updateIcon();
  }
  bindActionRunner(actionRunner) {
    const listeners = new DisposableStore();
    listeners.add(actionRunner.onWillRun((e) => {
      if (e.action === this.action) {
        this.setRunning(true);
      }
    }));
    listeners.add(actionRunner.onDidRun((e) => {
      if (e.action === this.action) {
        this.setRunning(false);
      }
    }));
    this.actionRunnerListener.value = listeners;
  }
  setRunning(running) {
    if (this.running === running) {
      return;
    }
    this.running = running;
    this.renderRunningState();
    if (running) {
      status(localize("chat.forkConversation.runningStatus", "Forking conversation"));
    }
  }
  renderRunningState() {
    this.updateIcon();
    this.label?.setAttribute("aria-busy", String(this.running));
    this.updateTooltip();
  }
  updateIcon() {
    if (!this.label || !this.icon) {
      return;
    }
    this.label.classList.remove(...labelIconClasses);
    this.icon.classList.remove(...forkIconClasses, ...spinnerIconClasses);
    this.icon.classList.add(...this.running ? spinnerIconClasses : forkIconClasses);
  }
}
export {
  ChatForkActionViewItem
};
