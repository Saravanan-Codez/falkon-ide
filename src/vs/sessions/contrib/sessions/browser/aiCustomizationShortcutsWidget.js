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
import "../../../browser/media/sidebarActionButton.css";
import "./media/customizationsToolbar.css";
import * as DOM from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun, derived } from "../../../../base/common/observable.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { IMcpService } from "../../../../workbench/contrib/mcp/common/mcpTypes.js";
import { IAICustomizationItemsModel } from "../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationItemsModel.js";
import { ICustomizationHarnessService } from "../../../../workbench/contrib/chat/common/customizationHarnessService.js";
import { CUSTOMIZATION_ITEMS } from "./customizationsToolbar.contribution.js";
import { Menus } from "../../../browser/menus.js";
const $ = DOM.$;
const CUSTOMIZATIONS_VERTICAL_PADDING = 6;
const CUSTOMIZATIONS_COLLAPSED_STORAGE_KEY = "agentSessions.customizationsShortcuts.collapsed";
let AICustomizationShortcutsWidget = class extends Disposable {
  constructor(container, options, instantiationService, mcpService, itemsModel, harnessService, storageService) {
    super();
    this.instantiationService = instantiationService;
    this.mcpService = mcpService;
    this.itemsModel = itemsModel;
    this.harnessService = harnessService;
    this.storageService = storageService;
    this._renderDisposables = this._register(new DisposableStore());
    this._rootVerticalPadding = 0;
    this._headerTotalCount = 0;
    this._collapsed = false;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._onDidToggleCollapsed = this._register(new Emitter());
    this.onDidToggleCollapsed = this._onDidToggleCollapsed.event;
    this._collapsed = this.storageService.getBoolean(CUSTOMIZATIONS_COLLAPSED_STORAGE_KEY, StorageScope.PROFILE, false);
    this._wrapper = DOM.append(container, $(".ai-customization-shortcuts-widget"));
    this._options = options;
    this._renderForCurrentMode();
  }
  get collapsed() {
    return this._collapsed;
  }
  get collapsedHeight() {
    const headerHeight = this._headerElement?.offsetHeight ?? 30;
    return this._rootVerticalPadding + headerHeight;
  }
  _renderForCurrentMode() {
    if (!this._wrapper) {
      return;
    }
    this._renderDisposables.clear();
    this._scrollableElement = void 0;
    this._toolbar = void 0;
    this._headerElement = void 0;
    this._headerTotalCountElement = void 0;
    this._chevronElement = void 0;
    this._toolbarContentElement = void 0;
    this._scrollableDomNode = void 0;
    this._rootVerticalPadding = 0;
    this._headerTotalCount = 0;
    DOM.clearNode(this._wrapper);
    this._render(this._wrapper, this._options);
    this._setCollapsed(this._collapsed);
  }
  _totalCount() {
    return derived((reader) => {
      this.harnessService.activeHarness.read(reader);
      this.harnessService.availableHarnesses.read(reader);
      const hidden = new Set(this.harnessService.getActiveDescriptor().hiddenSections ?? []);
      let total = 0;
      for (const config of CUSTOMIZATION_ITEMS) {
        if (config.section && hidden.has(config.section)) {
          continue;
        }
        if (config.modelSection) {
          total += this.itemsModel.getCount(config.modelSection).read(reader);
        } else if (config.isMcp) {
          total += this.mcpService.servers.read(reader).length;
        } else if (config.isPlugins) {
          total += this.itemsModel.getPluginCount().read(reader);
        }
      }
      return total;
    });
  }
  _render(parent, options) {
    const container = DOM.append(parent, $(".ai-customization-toolbar"));
    this._setRootPadding(container, CUSTOMIZATIONS_VERTICAL_PADDING, CUSTOMIZATIONS_VERTICAL_PADDING);
    const header = DOM.append(container, $(".ai-customization-header"));
    this._headerElement = header;
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", "true");
    header.tabIndex = 0;
    const headerLabel = DOM.append(header, $("span.ai-customization-header-label"));
    headerLabel.textContent = localize("customizations", "Customizations");
    this._headerTotalCountElement = DOM.append(header, $("span.ai-customization-header-total-count.hidden"));
    this._chevronElement = DOM.append(header, $("span.ai-customization-chevron"));
    this._chevronElement.setAttribute("aria-hidden", "true");
    this._updateChevron();
    const totalCount = this._totalCount();
    this._renderDisposables.add(autorun((reader) => {
      this._headerTotalCount = totalCount.read(reader);
      this._renderHeaderTotalCount();
    }));
    this._renderDisposables.add(DOM.addDisposableListener(header, DOM.EventType.CLICK, () => this._toggleCollapsed()));
    this._renderDisposables.add(DOM.addDisposableListener(header, DOM.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._toggleCollapsed();
      }
    }));
    const scrollContent = $(".ai-customization-toolbar-content-scrollable");
    const toolbarContainer = DOM.append(scrollContent, $(".ai-customization-toolbar-content.sidebar-action-list"));
    this._toolbarContentElement = toolbarContainer;
    const scrollableElement = this._renderDisposables.add(new DomScrollableElement(scrollContent, {
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Auto,
      useShadows: false
    }));
    this._scrollableElement = scrollableElement;
    this._scrollableDomNode = DOM.append(container, scrollableElement.getDomNode());
    const toolbar = this._renderDisposables.add(this.instantiationService.createInstance(MenuWorkbenchToolBar, toolbarContainer, Menus.SidebarCustomizations, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: { primaryGroup: () => true },
      telemetrySource: "sidebarCustomizations"
    }));
    this._toolbar = toolbar;
    this._renderDisposables.add(toolbar.onDidChangeMenuItems(() => {
      this._scrollableElement?.scanDomNode();
      this._onDidChangeHeight.fire();
      options?.onDidChangeLayout?.();
    }));
  }
  get desiredHeight() {
    const content = this._toolbarContentElement;
    if (!content) {
      return 0;
    }
    if (this._collapsed) {
      return this.collapsedHeight;
    }
    const headerHeight = this._headerElement?.offsetHeight ?? 0;
    const height = Math.ceil(this._rootVerticalPadding + headerHeight + content.scrollHeight);
    return Number.isFinite(height) ? height : 0;
  }
  _setRootPadding(element, top, bottom) {
    element.style.padding = `${top}px 0 ${bottom}px 0`;
    this._rootVerticalPadding = top + bottom;
  }
  _toggleCollapsed() {
    this._setCollapsed(!this._collapsed);
    this.storageService.store(CUSTOMIZATIONS_COLLAPSED_STORAGE_KEY, this._collapsed, StorageScope.PROFILE, StorageTarget.USER);
    this._onDidToggleCollapsed.fire(this._collapsed);
    this._onDidChangeHeight.fire();
  }
  _setCollapsed(collapsed) {
    if (collapsed && this._scrollableDomNode?.contains(DOM.getActiveElement())) {
      this._headerElement?.focus();
    }
    this._collapsed = collapsed;
    this._headerElement?.classList.toggle("collapsed", collapsed);
    this._headerElement?.setAttribute("aria-expanded", String(!collapsed));
    if (this._scrollableDomNode) {
      this._scrollableDomNode.style.display = collapsed ? "none" : "";
    }
    this._updateChevron();
    this._renderHeaderTotalCount();
  }
  _updateChevron() {
    if (!this._chevronElement) {
      return;
    }
    this._chevronElement.className = "ai-customization-chevron";
    this._chevronElement.classList.add(...ThemeIcon.asClassNameArray(this._collapsed ? Codicon.chevronRight : Codicon.chevronDown));
  }
  _renderHeaderTotalCount() {
    if (!this._headerTotalCountElement) {
      return;
    }
    this._headerTotalCountElement.textContent = this._headerTotalCount > 0 ? `${this._headerTotalCount}` : "";
    this._headerTotalCountElement.classList.toggle("hidden", !this._collapsed || this._headerTotalCount === 0);
  }
  layout(_height, _width) {
    if (this._collapsed) {
      return;
    }
    this._scrollableElement?.scanDomNode();
  }
  focus() {
    if (this._collapsed) {
      this._headerElement?.focus();
      return;
    }
    this._toolbar?.focus();
  }
};
AICustomizationShortcutsWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMcpService),
  __decorateParam(4, IAICustomizationItemsModel),
  __decorateParam(5, ICustomizationHarnessService),
  __decorateParam(6, IStorageService)
], AICustomizationShortcutsWidget);
export {
  AICustomizationShortcutsWidget
};
