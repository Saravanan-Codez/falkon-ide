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
import "./media/sessionInputBanners.css";
import * as dom from "../../../../base/browser/dom.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { asCssVariable } from "../../../../platform/theme/common/colorUtils.js";
import { chartsOrange } from "../../../../platform/theme/common/colors/chartsColors.js";
const SHOW_WORKING_DELAY_MS = 50;
let SessionInputBannerWidget = class extends Disposable {
  constructor(banner, hoverService) {
    super();
    this.hoverService = hoverService;
    this._buttons = [];
    /** Guards against overlapping runs while an action is already in flight. */
    this._running = false;
    this.domNode = dom.$(".session-input-banner");
    this.domNode.classList.toggle("accent-orange", banner.accent);
    this.domNode.setAttribute("role", "status");
    this.domNode.setAttribute("aria-label", banner.ariaLabel);
    const icon = dom.append(this.domNode, dom.$(".session-input-banner-icon"));
    icon.appendChild(renderIcon(banner.icon));
    const textEl = dom.append(this.domNode, dom.$("span.session-input-banner-text"));
    textEl.textContent = banner.text;
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), textEl, banner.text));
    const actions = dom.append(this.domNode, dom.$(".session-input-banner-actions"));
    for (const action of banner.actions) {
      const button = this._register(new Button(actions, {
        ...defaultButtonStyles,
        ...action.primary && banner.accent ? {
          buttonBackground: asCssVariable(chartsOrange),
          buttonHoverBackground: `color-mix(in srgb, ${asCssVariable(chartsOrange)} 88%, black)`,
          buttonBorder: asCssVariable(chartsOrange)
        } : {},
        ...action.primary ? {} : {
          buttonBackground: void 0,
          buttonHoverBackground: void 0,
          buttonForeground: void 0,
          buttonSecondaryBackground: void 0,
          buttonSecondaryHoverBackground: void 0,
          buttonSecondaryForeground: void 0,
          buttonSecondaryBorder: void 0
        },
        secondary: !action.primary
      }));
      button.element.classList.add("session-input-banner-action");
      button.label = action.label;
      button.element.ariaLabel = `${banner.ariaLabel} ${action.label}`;
      this._buttons.push(button);
      this._register(button.onDidClick(() => {
        void this._runAction(action);
      }));
    }
    if (banner.dismiss && banner.dismissTooltip) {
      const dismiss = dom.append(this.domNode, dom.$("button.session-input-banner-dismiss"));
      dismiss.type = "button";
      dismiss.setAttribute("aria-label", banner.dismissTooltip);
      dismiss.appendChild(renderIcon(Codicon.close));
      this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), dismiss, banner.dismissTooltip));
      this._register(dom.addDisposableListener(dismiss, dom.EventType.CLICK, (e) => {
        dom.EventHelper.stop(e, true);
        banner.dismiss?.();
      }));
    }
  }
  /**
   * Runs an action. When it returns a promise (e.g. the CI "Fix Checks"
   * action, which fetches check annotations before submitting a prompt), the
   * banner disables its buttons for the duration and shows an animated
   * "working" border so the delay is visible to the user. Buttons are disabled
   * immediately, but the animation is only shown once the work has been running
   * for {@link SHOW_WORKING_DELAY_MS} so very fast actions don't cause a
   * loading flicker. Never rejects: action errors are swallowed here since this
   * is invoked fire-and-forget from the click handler (the action is
   * responsible for surfacing its own errors).
   */
  async _runAction(action) {
    if (this._running) {
      return;
    }
    let result;
    try {
      result = action.run();
    } catch {
      return;
    }
    if (!result) {
      return;
    }
    this._running = true;
    this._setButtonsEnabled(false);
    const showAnimation = disposableTimeout(() => this.domNode.classList.add("working"), SHOW_WORKING_DELAY_MS);
    try {
      await result;
    } catch {
    } finally {
      showAnimation.dispose();
      this.domNode.classList.remove("working");
      this._setButtonsEnabled(true);
      this._running = false;
    }
  }
  /**
   * Renders the in-flight "working" state: shows the animated border and
   * disables the action buttons. Intended for fixtures/tests that need to
   * display the loading appearance statically; production toggles this state
   * via {@link _runAction} (which additionally delays the animation).
   */
  setWorking(working) {
    this.domNode.classList.toggle("working", working);
    this._setButtonsEnabled(!working);
  }
  _setButtonsEnabled(enabled) {
    for (const button of this._buttons) {
      button.enabled = enabled;
    }
  }
};
SessionInputBannerWidget = __decorateClass([
  __decorateParam(1, IHoverService)
], SessionInputBannerWidget);
export {
  SessionInputBannerWidget
};
