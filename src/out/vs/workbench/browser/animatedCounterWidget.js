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
import "./media/animatedCounterWidget.css";
import * as dom from "../../base/browser/dom.js";
import { Throttler } from "../../base/common/async.js";
import { Disposable } from "../../base/common/lifecycle.js";
import { autorun } from "../../base/common/observable.js";
import { IAccessibilityService } from "../../platform/accessibility/common/accessibility.js";
let AnimatedCounterWidget = class extends Disposable {
  constructor(container, _options, _accessibilityService) {
    super();
    this._options = _options;
    this._accessibilityService = _accessibilityService;
    this._hasRendered = false;
    this._updateThrottler = this._register(new Throttler());
    const { cssClassName, duration } = _options;
    this._element = cssClassName ? dom.$(`div.monaco-animated-counter.${cssClassName}`) : dom.$("div.monaco-animated-counter");
    this._element.appendChild(dom.$(`div`));
    container.appendChild(this._element);
    this._animationOptions = {
      duration: duration ?? 240,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both"
    };
    this._register(autorun((reader) => {
      const count = this._options.count.read(reader);
      this._updateThrottler.queue(() => this._update(count));
    }));
  }
  async _update(count) {
    if (!this._element || this._element.children.length === 0) {
      return;
    }
    const outgoingElement = this._element.children[0];
    if (count === void 0) {
      outgoingElement.textContent = "";
      this._count = void 0;
      this._hasRendered = false;
      return;
    }
    const incomingElementText = `${this._options.prefix ?? ""}${count}`;
    if (this._options.duration === 0 || !this._hasRendered || this._accessibilityService.isMotionReduced()) {
      outgoingElement.textContent = incomingElementText;
      this._count = count;
      this._hasRendered = true;
      return;
    }
    const previousWidth = this._element.getBoundingClientRect().width;
    const incomingElement = dom.$(`div`, void 0, incomingElementText);
    this._element?.appendChild(incomingElement);
    const nextWidth = incomingElement.getBoundingClientRect().width;
    if (Math.abs(previousWidth - nextWidth) > 0.5) {
      this._element.animate([
        { width: `${previousWidth}px` },
        { width: `${nextWidth}px` }
      ], this._animationOptions);
    }
    const directionOption = this._options.direction ?? "topToBottom";
    const directionTopBottom = directionOption === "topToBottom" ? count > (this._count ?? 0) : count < (this._count ?? 0);
    const enterFrom = directionTopBottom ? "-100%" : "100%";
    const exitTo = directionTopBottom ? "100%" : "-100%";
    incomingElement.animate([
      { transform: `translateY(${enterFrom})`, opacity: 0 },
      { transform: "translateY(0)", opacity: 1 }
    ], this._animationOptions);
    const exit = outgoingElement.animate([
      { transform: "translateY(0)", opacity: 1 },
      { transform: `translateY(${exitTo})`, opacity: 0 }
    ], this._animationOptions);
    await new Promise((resolve) => {
      let didCleanup = false;
      const cleanup = () => {
        if (didCleanup) {
          return;
        }
        didCleanup = true;
        this._count = count;
        this._element?.removeChild(outgoingElement);
        resolve();
      };
      exit.addEventListener("cancel", cleanup);
      exit.addEventListener("finish", cleanup);
    });
  }
};
AnimatedCounterWidget = __decorateClass([
  __decorateParam(2, IAccessibilityService)
], AnimatedCounterWidget);
export {
  AnimatedCounterWidget
};
