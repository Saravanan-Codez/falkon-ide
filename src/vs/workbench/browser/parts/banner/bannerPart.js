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
import "./media/bannerpart.css";
import { localize, localize2 } from "../../../../nls.js";
import { $, addDisposableListener, append, clearNode, EventType, isHTMLElement } from "../../../../base/browser/dom.js";
import { asCSSUrl } from "../../../../base/browser/cssValue.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Part } from "../../part.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { Action } from "../../../../base/common/actions.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { Emitter } from "../../../../base/common/event.js";
import { IBannerService } from "../../../services/banner/browser/bannerService.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { URI } from "../../../../base/common/uri.js";
import { widgetClose } from "../../../../platform/theme/common/iconRegistry.js";
import { BannerFocused } from "../../../common/contextkeys.js";
let BannerPart = class extends Part {
  constructor(themeService, layoutService, storageService, contextKeyService, instantiationService, markdownRendererService) {
    super(Parts.BANNER_PART, { hasTitle: false }, themeService, storageService, layoutService);
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.markdownRendererService = markdownRendererService;
    // #region IView
    this.height = 26;
    this.minimumWidth = 0;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this._onDidChangeSize = this._register(new Emitter());
    this.visible = false;
    this.focusedActionIndex = -1;
  }
  get minimumHeight() {
    return this.visible ? this.height : 0;
  }
  get maximumHeight() {
    return this.visible ? this.height : 0;
  }
  get onDidChange() {
    return this._onDidChangeSize.event;
  }
  createContentArea(parent) {
    this.element = parent;
    this.element.tabIndex = 0;
    this._register(addDisposableListener(this.element, EventType.FOCUS, () => {
      if (this.focusedActionIndex !== -1) {
        this.focusActionLink();
      }
    }));
    const scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.element));
    BannerFocused.bindTo(scopedContextKeyService).set(true);
    return this.element;
  }
  close(item) {
    this.setVisibility(false);
    clearNode(this.element);
    if (typeof item.onClose === "function") {
      item.onClose();
    }
    this.item = void 0;
  }
  focusActionLink() {
    const length = this.item?.actions?.length ?? 0;
    if (this.focusedActionIndex < length) {
      const actionLink = this.messageActionsContainer?.children[this.focusedActionIndex];
      if (isHTMLElement(actionLink)) {
        this.actionBar?.setFocusable(false);
        actionLink.focus();
      }
    } else {
      this.actionBar?.focus(0);
    }
  }
  getAriaLabel(item) {
    if (item.ariaLabel) {
      return item.ariaLabel;
    }
    if (typeof item.message === "string") {
      return item.message;
    }
    return void 0;
  }
  getBannerMessage(message) {
    if (typeof message === "string") {
      const element = $("span");
      element.textContent = message;
      return element;
    }
    return this.markdownRendererService.render(message).element;
  }
  setVisibility(visible) {
    if (visible !== this.visible) {
      this.visible = visible;
      this.focusedActionIndex = -1;
      this.layoutService.setPartHidden(!visible, Parts.BANNER_PART);
      this._onDidChangeSize.fire(void 0);
    }
  }
  focus() {
    this.focusedActionIndex = -1;
    this.element.focus();
  }
  focusNextAction() {
    const length = this.item?.actions?.length ?? 0;
    this.focusedActionIndex = this.focusedActionIndex < length ? this.focusedActionIndex + 1 : 0;
    this.focusActionLink();
  }
  focusPreviousAction() {
    const length = this.item?.actions?.length ?? 0;
    this.focusedActionIndex = this.focusedActionIndex > 0 ? this.focusedActionIndex - 1 : length;
    this.focusActionLink();
  }
  hide(id) {
    if (this.item?.id !== id) {
      return;
    }
    this.setVisibility(false);
  }
  show(item) {
    if (item.id === this.item?.id) {
      this.setVisibility(true);
      return;
    }
    clearNode(this.element);
    const ariaLabel = this.getAriaLabel(item);
    if (ariaLabel) {
      this.element.setAttribute("aria-label", ariaLabel);
    }
    const iconContainer = append(this.element, $("div.icon-container"));
    iconContainer.setAttribute("aria-hidden", "true");
    if (ThemeIcon.isThemeIcon(item.icon)) {
      iconContainer.appendChild($(`div${ThemeIcon.asCSSSelector(item.icon)}`));
    } else {
      iconContainer.classList.add("custom-icon");
      if (URI.isUri(item.icon)) {
        iconContainer.style.backgroundImage = asCSSUrl(item.icon);
      }
    }
    const messageContainer = append(this.element, $("div.message-container"));
    messageContainer.setAttribute("aria-hidden", "true");
    messageContainer.appendChild(this.getBannerMessage(item.message));
    this.messageActionsContainer = append(this.element, $("div.message-actions-container"));
    if (item.actions) {
      for (const action of item.actions) {
        this._register(this.instantiationService.createInstance(Link, this.messageActionsContainer, { ...action, tabIndex: -1 }, {}));
      }
    }
    const actionBarContainer = append(this.element, $("div.action-container"));
    this.actionBar = this._register(new ActionBar(actionBarContainer));
    const label = item.closeLabel ?? localize("closeBanner", "Close Banner");
    const closeAction = this._register(new Action("banner.close", label, ThemeIcon.asClassName(widgetClose), true, () => this.close(item)));
    this.actionBar.push(closeAction, { icon: true, label: false });
    this.actionBar.setFocusable(false);
    this.setVisibility(true);
    this.item = item;
  }
  toJSON() {
    return {
      type: Parts.BANNER_PART
    };
  }
};
BannerPart = __decorateClass([
  __decorateParam(0, IThemeService),
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IMarkdownRendererService)
], BannerPart);
registerSingleton(IBannerService, BannerPart, InstantiationType.Eager);
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.banner.focusBanner",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.Escape,
  when: BannerFocused,
  handler: (accessor) => {
    const bannerService = accessor.get(IBannerService);
    bannerService.focus();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.banner.focusNextAction",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.RightArrow,
  secondary: [KeyCode.DownArrow],
  when: BannerFocused,
  handler: (accessor) => {
    const bannerService = accessor.get(IBannerService);
    bannerService.focusNextAction();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.banner.focusPreviousAction",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.LeftArrow,
  secondary: [KeyCode.UpArrow],
  when: BannerFocused,
  handler: (accessor) => {
    const bannerService = accessor.get(IBannerService);
    bannerService.focusPreviousAction();
  }
});
class FocusBannerAction extends Action2 {
  static {
    this.ID = "workbench.action.focusBanner";
  }
  static {
    this.LABEL = localize2("focusBanner", "Focus Banner");
  }
  constructor() {
    super({
      id: FocusBannerAction.ID,
      title: FocusBannerAction.LABEL,
      category: Categories.View,
      f1: true
    });
  }
  async run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    layoutService.focusPart(Parts.BANNER_PART);
  }
}
registerAction2(FocusBannerAction);
export {
  BannerPart
};
