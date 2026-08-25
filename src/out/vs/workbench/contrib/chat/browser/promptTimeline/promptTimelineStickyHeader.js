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
import { $, addDisposableListener, append, EventType } from "../../../../../base/browser/dom.js";
import { Action } from "../../../../../base/common/actions.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { WorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import "./media/promptTimeline.css";
const PREVIOUS_ACTION_ID = "promptTimeline.sticky.previous";
const NEXT_ACTION_ID = "promptTimeline.sticky.next";
let PromptTimelineStickyHeader = class extends Disposable {
  constructor(container, instantiationService, accessibilityService) {
    super();
    this.accessibilityService = accessibilityService;
    this._currentLabel = "";
    this._visible = false;
    this._onDidActivate = this._register(new Emitter());
    /** Fired when the label is clicked or activated by keyboard. */
    this.onDidActivate = this._onDidActivate.event;
    this._onDidNavigate = this._register(new Emitter());
    /** Fired with `-1` (previous prompt) or `+1` (next prompt) when a navigation action is run. */
    this.onDidNavigate = this._onDidNavigate.event;
    this._domNode = append(container, $(".prompt-timeline-sticky"));
    const content = append(this._domNode, $(".prompt-timeline-sticky-content"));
    const band = append(content, $(".prompt-timeline-sticky-band"));
    this._labelButton = append(band, $("button.prompt-timeline-sticky-label-button"));
    this._label = append(this._labelButton, $("span.prompt-timeline-sticky-label"));
    this._labelLine = this._createLine("");
    this._label.appendChild(this._labelLine);
    this._count = append(this._labelButton, $("span.prompt-timeline-sticky-count"));
    this._register(addDisposableListener(this._labelButton, EventType.CLICK, () => this._onDidActivate.fire()));
    this._previousAction = this._register(new Action(PREVIOUS_ACTION_ID, localize("promptTimeline.previousPrompt", "Go to Previous Prompt"), ThemeIcon.asClassName(Codicon.chevronUp), true, async () => this._onDidNavigate.fire(-1)));
    this._nextAction = this._register(new Action(NEXT_ACTION_ID, localize("promptTimeline.nextPrompt", "Go to Next Prompt"), ThemeIcon.asClassName(Codicon.chevronDown), true, async () => this._onDidNavigate.fire(1)));
    const toolbarContainer = append(band, $(".prompt-timeline-sticky-nav"));
    const toolbar = this._register(instantiationService.createInstance(WorkbenchToolBar, toolbarContainer, {
      ariaLabel: localize("promptTimeline.stickyNavAriaLabel", "Prompt navigation")
    }));
    toolbar.setActions([this._previousAction, this._nextAction]);
    this._setVisible(false);
  }
  get domNode() {
    return this._domNode;
  }
  /** Names the pinned prompt (1-based index within all prompts). */
  update(text, index, total) {
    const label = text || localize("promptTimeline.emptyPrompt", "(empty prompt)");
    this._count.textContent = localize("promptTimeline.stickyCount", "{0}/{1}", index, total);
    this._labelButton.title = label;
    this._labelButton.setAttribute("aria-label", localize("promptTimeline.stickyLabel", "Go to prompt {0} of {1}: {2}", index, total, label));
    this._previousAction.enabled = index > 1;
    this._nextAction.enabled = index < total;
    if (label !== this._currentLabel || index !== this._lastIndex) {
      const direction = this._lastIndex !== void 0 && index !== this._lastIndex ? Math.sign(index - this._lastIndex) : 0;
      const newLine = this._createLine(label);
      this._label.appendChild(newLine);
      const oldLine = this._labelLine;
      this._labelLine = newLine;
      if (this._visible && direction !== 0 && !this.accessibilityService.isMotionReduced()) {
        this._roll(oldLine, newLine, direction);
      } else {
        this._finalizeRoll();
        oldLine.remove();
      }
      this._currentLabel = label;
    }
    this._lastIndex = index;
  }
  _createLine(text) {
    const line = $(".prompt-timeline-sticky-label-line");
    append(line, $("span.prompt-timeline-sticky-label-text")).textContent = text;
    return line;
  }
  /** Rolls the outgoing label out and the incoming label in, following the scroll direction. */
  _roll(oldLine, newLine, direction) {
    this._finalizeRoll();
    const timing = { duration: 140, easing: "ease" };
    const outTo = direction > 0 ? -100 : 100;
    const inFrom = direction > 0 ? 100 : -100;
    const outAnim = oldLine.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${outTo}%)`, opacity: 0 }], timing);
    const inAnim = newLine.animate([{ transform: `translateY(${inFrom}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], timing);
    this._rollOutgoing = oldLine;
    this._rollOutAnim = outAnim;
    this._rollInAnim = inAnim;
    outAnim.finished.then(() => oldLine.remove(), () => {
    });
    inAnim.finished.then(() => {
      if (this._rollInAnim === inAnim) {
        this._rollInAnim = this._rollOutAnim = this._rollOutgoing = void 0;
      }
    }, () => {
    });
  }
  /** Commits any in-flight roll immediately so a new one can start from a settled state. */
  _finalizeRoll() {
    this._rollInAnim?.finish();
    this._rollOutAnim?.finish();
    this._rollOutgoing?.remove();
    this._rollInAnim = this._rollOutAnim = this._rollOutgoing = void 0;
  }
  setVisible(visible) {
    this._setVisible(visible);
  }
  _setVisible(visible) {
    this._visible = visible;
    this._domNode.classList.toggle("hidden", !visible);
    this._domNode.toggleAttribute("inert", !visible);
    if (!visible) {
      this._finalizeRoll();
    }
  }
  dispose() {
    this._rollInAnim?.cancel();
    this._rollOutAnim?.cancel();
    this._domNode.remove();
    super.dispose();
  }
};
PromptTimelineStickyHeader = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IAccessibilityService)
], PromptTimelineStickyHeader);
export {
  PromptTimelineStickyHeader
};
