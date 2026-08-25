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
import { $, append, EventHelper, clearNode } from "../../../base/browser/dom.js";
import { DomEmitter } from "../../../base/browser/event.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { EventType as TouchEventType, Gesture } from "../../../base/browser/touch.js";
import { Event } from "../../../base/common/event.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IOpenerService } from "../common/opener.js";
import "./link.css";
import { getDefaultHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../hover/browser/hover.js";
let Link = class extends Disposable {
  constructor(container, _link, options = {}, _hoverService, openerService) {
    super();
    this._link = _link;
    this._hoverService = _hoverService;
    this._enabled = true;
    this.el = append(container, $("a.monaco-link", {
      tabIndex: _link.tabIndex ?? 0,
      href: _link.href
    }, _link.label));
    this.hoverDelegate = options.hoverDelegate ?? getDefaultHoverDelegate("mouse");
    this.setTooltip(_link.title);
    this.el.setAttribute("role", "button");
    const onClickEmitter = this._register(new DomEmitter(this.el, "click"));
    const onKeyDown = this._register(new DomEmitter(this.el, "keydown"));
    const onKeyActivate = Event.chain(
      onKeyDown.event,
      ($2) => $2.map((e) => new StandardKeyboardEvent(e)).filter((e) => e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Space)
    );
    const onTap = this._register(new DomEmitter(this.el, TouchEventType.Tap)).event;
    this._register(Gesture.addTarget(this.el));
    const onOpen = Event.any(onClickEmitter.event, onKeyActivate, onTap);
    this._register(onOpen((e) => {
      if (!this.enabled) {
        return;
      }
      EventHelper.stop(e, true);
      if (options?.opener) {
        options.opener(this._link.href);
      } else {
        openerService.open(this._link.href, { allowCommands: true });
      }
    }));
    this.enabled = true;
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(enabled) {
    if (enabled) {
      this.el.setAttribute("aria-disabled", "false");
      this.el.tabIndex = 0;
      this.el.style.pointerEvents = "auto";
      this.el.style.opacity = "1";
      this.el.style.cursor = "pointer";
      this._enabled = false;
    } else {
      this.el.setAttribute("aria-disabled", "true");
      this.el.tabIndex = -1;
      this.el.style.pointerEvents = "none";
      this.el.style.opacity = "0.4";
      this.el.style.cursor = "default";
      this._enabled = true;
    }
    this._enabled = enabled;
  }
  set link(link) {
    if (typeof link.label === "string") {
      this.el.textContent = link.label;
    } else {
      clearNode(this.el);
      this.el.appendChild(link.label);
    }
    this.el.href = link.href;
    if (typeof link.tabIndex !== "undefined") {
      this.el.tabIndex = link.tabIndex;
    }
    this.setTooltip(link.title);
    this._link = link;
  }
  setTooltip(title) {
    if (!this.hover && title) {
      this.hover = this._register(this._hoverService.setupManagedHover(this.hoverDelegate, this.el, title));
    } else if (this.hover) {
      this.hover.update(title);
    }
  }
};
Link = __decorateClass([
  __decorateParam(3, IHoverService),
  __decorateParam(4, IOpenerService)
], Link);
export {
  Link
};
