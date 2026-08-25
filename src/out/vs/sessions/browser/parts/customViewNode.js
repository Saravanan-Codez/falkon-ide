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
import "./media/customViewGridPart.css";
import { $, isAncestorOfActiveElement } from "../../../base/browser/dom.js";
import { DomScrollableElement } from "../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { autorun } from "../../../base/common/observable.js";
import { ScrollbarVisibility } from "../../../base/common/scrollable.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../platform/actions/browser/toolbar.js";
import { MenuItemAction } from "../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { asCssVariable } from "../../../platform/theme/common/colorUtils.js";
import { AGENTS_CENTERED_CONTENT_MAX_WIDTH } from "../../common/layoutConstants.js";
import { activeSessionViewBackground, activeSessionViewForeground } from "../../common/theme.js";
import { SessionHeaderMetaActionViewItem } from "./sessionHeaderMetaActionViewItem.js";
let CustomViewNode = class extends Disposable {
  constructor(descriptor, instantiationService) {
    super();
    this.element = $(".custom-view-node");
    this._view = this._register(instantiationService.createInstance(descriptor.ctor));
    this._maxWidth = this._view.maxWidth ?? AGENTS_CENTERED_CONTENT_MAX_WIDTH;
    this.element.style.setProperty("--session-view-background", asCssVariable(activeSessionViewBackground));
    this.element.style.setProperty("--session-view-foreground", asCssVariable(activeSessionViewForeground));
    this.element.setAttribute("role", "region");
    this.element.setAttribute("data-view-id", descriptor.id);
    this._headerEl = $(".custom-view-header");
    this.element.appendChild(this._headerEl);
    this._headerBandEl = $(".custom-view-header-band");
    this._headerEl.appendChild(this._headerBandEl);
    const titleRow = $(".custom-view-header-title-row");
    this._headerBandEl.appendChild(titleRow);
    this._titleEl = $(".custom-view-header-title");
    titleRow.appendChild(this._titleEl);
    this._descriptionEl = $(".custom-view-header-description");
    this._headerBandEl.appendChild(this._descriptionEl);
    if (descriptor.actions) {
      const buttonBar = descriptor.actions.style === "buttonBar";
      const actionsContainer = $(".custom-view-header-actions");
      actionsContainer.classList.toggle("custom-view-header-actions-buttons", buttonBar);
      titleRow.appendChild(actionsContainer);
      const toolbar = this._register(instantiationService.createInstance(MenuWorkbenchToolBar, actionsContainer, descriptor.actions.menuId, {
        hiddenItemStrategy: HiddenItemStrategy.Ignore,
        menuOptions: { shouldForwardArgs: true },
        toolbarOptions: { primaryGroup: () => true },
        actionViewItemProvider: buttonBar ? (action, options) => action instanceof MenuItemAction ? instantiationService.createInstance(SessionHeaderMetaActionViewItem, void 0, action, options) : void 0 : void 0
      }));
      this._register(toolbar.onDidChangeMenuItems(() => this._layoutChildren()));
    }
    const scrollContent = $(".custom-view-scroll-content");
    this._contentEl = $(".custom-view-content");
    this._contentEl.tabIndex = -1;
    scrollContent.appendChild(this._contentEl);
    this._scrollable = this._register(new DomScrollableElement(scrollContent, {
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Auto,
      useShadows: false
    }));
    this._scrollable.getDomNode().classList.add("custom-view-body");
    this.element.appendChild(this._scrollable.getDomNode());
    this._view.render(this._contentEl);
    const resizeObserver = new ResizeObserver(() => this._scrollable.scanDomNode());
    resizeObserver.observe(this._contentEl);
    this._register(toDisposable(() => resizeObserver.disconnect()));
    this._register(autorun((reader) => {
      const title = this._view.title.read(reader);
      this._titleEl.textContent = title;
      this.element.setAttribute("aria-label", title);
      this._layoutChildren();
    }));
    this._register(autorun((reader) => {
      const description = this._view.description.read(reader);
      this._descriptionEl.textContent = description ?? "";
      this._descriptionEl.classList.toggle("hidden", !description);
      this._layoutChildren();
    }));
    this._register(toDisposable(() => this.element.remove()));
  }
  layout(width, height) {
    this._lastLayout = { width, height };
    this._layoutChildren();
  }
  focus() {
    this._view.focus();
    if (!isAncestorOfActiveElement(this.element)) {
      this._contentEl.focus();
    }
  }
  _layoutChildren() {
    if (!this._lastLayout) {
      return;
    }
    const { width, height } = this._lastLayout;
    const bandWidth = Math.min(width, this._maxWidth);
    this._headerBandEl.style.width = `${bandWidth}px`;
    this._contentEl.style.width = `${bandWidth}px`;
    this._view.layout(bandWidth, Math.max(0, height - this._headerEl.offsetHeight));
    this._scrollable.scanDomNode();
  }
};
CustomViewNode = __decorateClass([
  __decorateParam(1, IInstantiationService)
], CustomViewNode);
export {
  CustomViewNode
};
