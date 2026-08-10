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
import * as dom from "../../../base/browser/dom.js";
import { Radio } from "../../../base/browser/ui/radio/radio.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { IContextViewService } from "../../contextview/browser/contextView.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ActionList } from "./actionList.js";
import "./tabbedActionListWidget.css";
let TabbedActionListWidget = class extends Disposable {
  constructor(_contextViewService, _instantiationService) {
    super();
    this._contextViewService = _contextViewService;
    this._instantiationService = _instantiationService;
    this._onDidChangeTab = this._register(new Emitter());
    this.onDidChangeTab = this._onDidChangeTab.event;
    this._onDidHide = this._register(new Emitter());
    this.onDidHide = this._onDidHide.event;
    this._activePopup = this._register(new MutableDisposable());
    this._swappingTab = false;
  }
  get isVisible() {
    return !!this._activePopup.value;
  }
  /**
   * Shows the popup anchored to {@link ITabbedActionListShowOptions.anchor}.
   * If a popup is already visible, it is replaced in place.
   */
  show(options) {
    const isSwap = this.isVisible;
    if (isSwap) {
      this._swappingTab = true;
      this._activePopup.value = void 0;
    }
    let activeTab = options.initialTab;
    const popupDisposables = new DisposableStore();
    const hide = () => {
      if (this._activePopup.value === popupDisposables) {
        this._activePopup.value = void 0;
      }
    };
    this._activePopup.value = popupDisposables;
    popupDisposables.add(toDisposable(() => {
      this._contextViewService.hideContextView();
    }));
    let listRef;
    this._contextViewService.showContextView({
      getAnchor: () => options.anchor,
      render: (container) => {
        const renderDisposables = new DisposableStore();
        const widget = dom.append(container, dom.$(".action-widget"));
        const tabBar = dom.append(widget, dom.$(".tabbed-action-list-tabbar"));
        if (options.tabBarClassName) {
          tabBar.classList.add(options.tabBarClassName);
        }
        const radio = renderDisposables.add(new Radio({
          items: options.tabs.map((tab) => {
            const label = tab.label ?? tab.id;
            const text = tab.icon ? `$(${tab.icon.id}) ${label}` : label;
            return { text, tooltip: tab.tooltip ?? label, isActive: tab.id === activeTab };
          })
        }));
        tabBar.appendChild(radio.domNode);
        const activateTab = (next) => {
          if (next === activeTab) {
            return;
          }
          activeTab = next;
          this._onDidChangeTab.fire(next);
          this.show({ ...options, initialTab: next });
        };
        renderDisposables.add(radio.onDidSelect((index) => {
          const next = options.tabs[index];
          if (next) {
            activateTab(next.id);
          }
        }));
        const { items, listOptions } = options.createActionList(activeTab);
        const list = renderDisposables.add(this._instantiationService.createInstance(
          ActionList,
          options.user,
          false,
          items,
          options.delegate,
          options.accessibilityProvider,
          listOptions,
          options.anchor
        ));
        listRef = list;
        if (list.filterContainer) {
          widget.appendChild(list.filterContainer);
        }
        widget.appendChild(list.domNode);
        const width = list.layout(0);
        widget.style.width = `${options.width ?? width}px`;
        list.focus();
        renderDisposables.add(dom.addStandardDisposableListener(widget, "keydown", (e) => {
          const target = e.target;
          const onTabBar = !!target?.closest(".tabbed-action-list-tabbar");
          const onEditable = !!target?.closest('input, textarea, [contenteditable="true"]');
          if (e.keyCode === KeyCode.Escape) {
            dom.EventHelper.stop(e, true);
            hide();
            return;
          }
          if (e.keyCode === KeyCode.Enter && !onTabBar) {
            dom.EventHelper.stop(e, true);
            list.acceptSelected();
            return;
          }
          if (e.keyCode === KeyCode.UpArrow && !onTabBar) {
            dom.EventHelper.stop(e, true);
            list.focusPrevious();
            return;
          }
          if (e.keyCode === KeyCode.DownArrow && !onTabBar) {
            dom.EventHelper.stop(e, true);
            list.focusNext();
            return;
          }
          if (e.keyCode !== KeyCode.LeftArrow && e.keyCode !== KeyCode.RightArrow) {
            return;
          }
          if (onEditable && !onTabBar) {
            return;
          }
          const currentIndex = options.tabs.findIndex((t) => t.id === activeTab);
          if (currentIndex < 0) {
            return;
          }
          const delta = e.keyCode === KeyCode.RightArrow ? 1 : -1;
          const nextIndex = (currentIndex + delta + options.tabs.length) % options.tabs.length;
          e.preventDefault();
          e.stopPropagation();
          activateTab(options.tabs[nextIndex].id);
        }));
        const focusTracker = renderDisposables.add(dom.trackFocus(container));
        renderDisposables.add(focusTracker.onDidBlur(() => {
          if (this._swappingTab) {
            return;
          }
          const activeElement = dom.getActiveElement();
          if (activeElement && (activeElement.closest(".action-widget-hover") || activeElement.closest(".action-list-submenu-panel"))) {
            return;
          }
          hide();
        }));
        return renderDisposables;
      },
      onHide: () => {
        listRef = void 0;
        if (this._swappingTab) {
          return;
        }
        if (this._activePopup.value === popupDisposables) {
          this._activePopup.value = void 0;
        }
        options.delegate.onHide?.();
        this._onDidHide.fire();
      },
      get anchorPosition() {
        return listRef?.anchorPosition;
      }
    }, void 0, false);
    if (isSwap) {
      this._swappingTab = false;
    }
  }
  hide() {
    this._activePopup.value = void 0;
  }
  dispose() {
    this._activePopup.value = void 0;
    super.dispose();
  }
};
TabbedActionListWidget = __decorateClass([
  __decorateParam(0, IContextViewService),
  __decorateParam(1, IInstantiationService)
], TabbedActionListWidget);
export {
  TabbedActionListWidget
};
