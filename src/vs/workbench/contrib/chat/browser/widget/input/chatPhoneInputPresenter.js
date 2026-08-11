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
import "./media/chatPhoneInputPresenter.css";
import * as dom from "../../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Gesture, EventType as TouchEventType } from "../../../../../../base/browser/touch.js";
import { BaseActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue } from "../../../../../../base/common/observable.js";
import { localize } from "../../../../../../nls.js";
import { InstantiationType, registerSingleton } from "../../../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../../../platform/instantiation/common/instantiation.js";
import { getModelProviderIcon } from "./modelPicker/modelProviderIcons.js";
const IChatPhoneInputPresenter = createDecorator("chatPhoneInputPresenter");
class ChatPhoneInputPresenterService extends Disposable {
  constructor() {
    super(...arguments);
    this._impl = observableValue(this, void 0);
    this.enabled = derived(this, (reader) => {
      const impl = this._impl.read(reader);
      return impl ? impl.enabled.read(reader) : false;
    });
  }
  showCombinedModeAndModelSheet(target, request) {
    const impl = this._impl.get();
    return impl ? impl.showCombinedModeAndModelSheet(target, request) : Promise.resolve();
  }
  setImpl(impl) {
    this._impl.set(impl, void 0);
    return toDisposable(() => {
      if (this._impl.get() === impl) {
        this._impl.set(void 0, void 0);
      }
    });
  }
}
registerSingleton(IChatPhoneInputPresenter, ChatPhoneInputPresenterService, InstantiationType.Delayed);
let MobileChatInputCombinedPickerActionItem = class extends BaseActionViewItem {
  constructor(action, _modeDelegate, _modelDelegate, _presenter) {
    super(void 0, action);
    this._modeDelegate = _modeDelegate;
    this._modelDelegate = _modelDelegate;
    this._presenter = _presenter;
    this._renderDisposables = this._register(new DisposableStore());
  }
  render(container) {
    this.element = container;
    container.classList.add("chat-input-picker-item");
    this._renderDisposables.clear();
    const trigger = dom.append(container, dom.$("a.action-label.chat-phone-input-chip"));
    trigger.tabIndex = 0;
    trigger.role = "button";
    this._triggerElement = trigger;
    this._renderDisposables.add(Gesture.addTarget(trigger));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._renderDisposables.add(dom.addDisposableListener(trigger, eventType, (e) => {
        dom.EventHelper.stop(e, true);
        this._showSheet();
      }));
    }
    this._renderDisposables.add(dom.addDisposableListener(trigger, dom.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        dom.EventHelper.stop(e, true);
        this._showSheet();
      }
    }));
    this._renderDisposables.add(autorun((reader) => {
      const currentMode = this._modeDelegate.currentMode.read(reader);
      currentMode.label.read(reader);
      currentMode.icon.read(reader);
      this._modelDelegate.currentModel.read(reader);
      this._updateTrigger();
    }));
  }
  _updateTrigger() {
    const trigger = this._triggerElement;
    if (!trigger) {
      return;
    }
    dom.clearNode(trigger);
    const currentMode = this._modeDelegate.currentMode.get();
    const modeIcon = currentMode.icon.get();
    if (modeIcon) {
      dom.append(trigger, renderIcon(modeIcon));
    }
    const currentModel = this._modelDelegate.currentModel.get();
    if (currentModel && this._modelDelegate.getPresentationOptions().showModelIcon) {
      dom.append(trigger, renderIcon(getModelProviderIcon(currentModel)));
    }
    const labelText = currentModel?.metadata.name ?? localize("chatPhoneInput.autoLabel", "Auto");
    const labelSpan = dom.append(trigger, dom.$("span.chat-input-picker-label"));
    labelSpan.textContent = labelText;
    const ariaParts = [];
    const modeLabel = currentMode.label.get();
    if (modeLabel) {
      ariaParts.push(modeLabel);
    }
    ariaParts.push(labelText);
    trigger.ariaLabel = localize(
      "chatPhoneInput.triggerAriaLabel",
      "Pick Mode and Model, {0}",
      ariaParts.join(", ")
    );
  }
  /** Belt-and-braces: keep the action's `run()` suppressed even if `super.render` is reintroduced. */
  onClick() {
  }
  async _showSheet() {
    const trigger = this._triggerElement;
    if (!trigger) {
      return;
    }
    trigger.setAttribute("aria-expanded", "true");
    try {
      await this._presenter.showCombinedModeAndModelSheet(trigger, {
        kind: "delegates",
        modeDelegate: this._modeDelegate,
        modelDelegate: this._modelDelegate
      });
    } finally {
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
    }
  }
};
MobileChatInputCombinedPickerActionItem = __decorateClass([
  __decorateParam(3, IChatPhoneInputPresenter)
], MobileChatInputCombinedPickerActionItem);
export {
  IChatPhoneInputPresenter,
  MobileChatInputCombinedPickerActionItem
};
