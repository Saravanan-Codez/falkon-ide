import "./media/agentFeedbackEditorInput.css";
import { addStandardDisposableListener, ModifierKeyEmitter } from "../../../../base/browser/dom.js";
import { status as announceStatus } from "../../../../base/browser/ui/aria/aria.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Action } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
class FeedbackInputWidget extends Disposable {
  constructor(_options) {
    super();
    this._options = _options;
    this._isShowingSecondary = false;
    this._busy = false;
    this._onDidTriggerPrimary = this._register(new Emitter());
    this.onDidTriggerPrimary = this._onDidTriggerPrimary.event;
    this._onDidTriggerSecondary = this._register(new Emitter());
    this.onDidTriggerSecondary = this._onDidTriggerSecondary.event;
    this._hasExplicitAriaLabel = _options.ariaLabel !== void 0;
    this.domNode = document.createElement("div");
    this.domNode.classList.add("agent-feedback-input-widget");
    this.domNode.style.display = "none";
    this.inputElement = document.createElement("textarea");
    this.inputElement.rows = 1;
    this.inputElement.placeholder = _options.placeholder;
    this.inputElement.setAttribute("aria-label", _options.ariaLabel ?? _options.placeholder);
    this.inputElement.style.lineHeight = `${FeedbackInputWidget._LINE_HEIGHT}px`;
    this.domNode.appendChild(this.inputElement);
    this._measureElement = document.createElement("span");
    this._measureElement.classList.add("agent-feedback-input-measure");
    this.domNode.appendChild(this._measureElement);
    const actionsContainer = document.createElement("div");
    actionsContainer.classList.add("agent-feedback-input-actions");
    actionsContainer.style.height = `${FeedbackInputWidget._LINE_HEIGHT}px`;
    this.domNode.appendChild(actionsContainer);
    this._actionsContainer = actionsContainer;
    this._busyIndicator = document.createElement("div");
    this._busyIndicator.classList.add("agent-feedback-input-busy-indicator", ...ThemeIcon.asClassNameArray(Codicon.loading), "codicon-modifier-spin");
    this._busyIndicator.setAttribute("aria-hidden", "true");
    this._busyIndicator.style.display = "none";
    this._busyIndicator.style.height = `${FeedbackInputWidget._LINE_HEIGHT}px`;
    this.domNode.appendChild(this._busyIndicator);
    this._primaryAction = this._register(new Action(
      "feedbackInput.primary",
      _options.primaryAction.label,
      ThemeIcon.asClassName(_options.primaryAction.icon),
      false,
      () => {
        this._onDidTriggerPrimary.fire();
        return Promise.resolve();
      }
    ));
    this._secondaryAction = _options.secondaryAction ? this._register(new Action(
      "feedbackInput.secondary",
      _options.secondaryAction.label,
      ThemeIcon.asClassName(_options.secondaryAction.icon),
      false,
      () => {
        this._onDidTriggerSecondary.fire();
        return Promise.resolve();
      }
    )) : void 0;
    this._actionBar = this._register(new ActionBar(actionsContainer));
    this._actionBar.push(this._primaryAction, { icon: true, label: false, keybinding: _options.primaryAction.keybindingLabel });
    if (this._secondaryAction) {
      const modifierKeyEmitter = ModifierKeyEmitter.getInstance();
      this._register(modifierKeyEmitter.event((status) => this._updateActionForAlt(status.altKey)));
    }
    this._register(addStandardDisposableListener(this.domNode, "mousedown", (e) => {
      const target = e.target;
      if (target === this.inputElement || actionsContainer.contains(target)) {
        return;
      }
      e.preventDefault();
      this.inputElement.focus();
    }));
  }
  static {
    this._MIN_WIDTH = 150;
  }
  static {
    this._MAX_WIDTH = 400;
  }
  static {
    // The input should never be wider than its host. Cap it to this fraction of
    // the available width so it doesn't render past the host bounds when narrow.
    this._MAX_WIDTH_HOST_FRACTION = 0.9;
  }
  static {
    this._LINE_HEIGHT = 22;
  }
  /** Whether {@link setBusy} is currently active; callers must not submit again while true. */
  get isBusy() {
    return this._busy;
  }
  _updateActionForAlt(altKey) {
    if (!this._secondaryAction) {
      return;
    }
    if (altKey && !this._isShowingSecondary) {
      this._isShowingSecondary = true;
      this._actionBar.clear();
      this._actionBar.push(this._secondaryAction, { icon: true, label: false, keybinding: this._options.secondaryAction.keybindingLabel });
    } else if (!altKey && this._isShowingSecondary) {
      this._isShowingSecondary = false;
      this._actionBar.clear();
      this._actionBar.push(this._primaryAction, { icon: true, label: false, keybinding: this._options.primaryAction.keybindingLabel });
    }
  }
  show() {
    this.domNode.style.display = "";
  }
  hide() {
    this.domNode.style.display = "none";
  }
  clearInput() {
    this.inputElement.value = "";
    this.updateActionEnabled();
    this.autoSize();
  }
  setPlaceholder(placeholder) {
    if (this.inputElement.placeholder === placeholder) {
      return;
    }
    this.inputElement.placeholder = placeholder;
    if (!this._hasExplicitAriaLabel) {
      this.inputElement.setAttribute("aria-label", placeholder);
    }
    this.autoSize();
  }
  updateActionEnabled() {
    const hasText = this.inputElement.value.trim().length > 0 && !this._busy;
    this._primaryAction.enabled = hasText;
    if (this._secondaryAction) {
      this._secondaryAction.enabled = hasText;
    }
  }
  /**
   * Toggles an accessible busy state: disables the input/actions, swaps the
   * action bar for a spinning loading codicon, and (when turning busy on)
   * announces `statusLabel` to screen readers via `aria-busy` + a status
   * announcement. Idempotent; a no-op call does not re-announce.
   */
  setBusy(busy, statusLabel) {
    if (this._busy === busy) {
      return;
    }
    this._busy = busy;
    this.inputElement.disabled = busy;
    this.inputElement.setAttribute("aria-busy", busy ? "true" : "false");
    this._actionsContainer.style.display = busy ? "none" : "";
    this._busyIndicator.style.display = busy ? "" : "none";
    this.updateActionEnabled();
    if (busy && statusLabel) {
      announceStatus(statusLabel);
    }
  }
  autoSize() {
    const text = this.inputElement.value || this.inputElement.placeholder;
    this._measureElement.textContent = text;
    const textWidth = this._measureElement.scrollWidth;
    const maxWidth = this._computeMaxWidth();
    const minWidth = Math.min(FeedbackInputWidget._MIN_WIDTH, maxWidth);
    const desiredWidth = Math.max(minWidth, textWidth + 10);
    const width = Math.min(desiredWidth, maxWidth);
    this.inputElement.style.minWidth = `${minWidth}px`;
    this.inputElement.style.width = `${width}px`;
    this.inputElement.style.height = "auto";
    const newHeight = Math.max(this.inputElement.scrollHeight, FeedbackInputWidget._LINE_HEIGHT);
    this.inputElement.style.height = `${newHeight}px`;
  }
  _computeMaxWidth() {
    return Math.min(FeedbackInputWidget._MAX_WIDTH, this._options.getMaxContentWidth() * FeedbackInputWidget._MAX_WIDTH_HOST_FRACTION);
  }
}
export {
  FeedbackInputWidget
};
