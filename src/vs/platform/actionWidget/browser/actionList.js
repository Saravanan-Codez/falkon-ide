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
import { renderMarkdown } from "../../../base/browser/markdownRenderer.js";
import { ActionBar } from "../../../base/browser/ui/actionbar/actionbar.js";
import { getAnchorRect } from "../../../base/browser/ui/contextview/contextview.js";
import { KeybindingLabel } from "../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { Toggle } from "../../../base/browser/ui/toggle/toggle.js";
import { List } from "../../../base/browser/ui/list/listWidget.js";
import { SubmenuAction, toAction } from "../../../base/common/actions.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Codicon } from "../../../base/common/codicons.js";
import { Emitter } from "../../../base/common/event.js";
import { isMarkdownString, MarkdownString } from "../../../base/common/htmlContent.js";
import { AnchorPosition } from "../../../base/common/layout.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { OS } from "../../../base/common/platform.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { URI } from "../../../base/common/uri.js";
import "./actionWidget.css";
import { localize } from "../../../nls.js";
import { IContextViewService } from "../../contextview/browser/contextView.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { IOpenerService } from "../../opener/common/opener.js";
import { Link } from "../../opener/browser/link.js";
import { defaultListStyles } from "../../theme/browser/defaultStyles.js";
import { asCssVariable } from "../../theme/common/colorRegistry.js";
import { ILayoutService } from "../../layout/browser/layoutService.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
const acceptSelectedActionCommand = "acceptSelectedCodeAction";
const previewSelectedActionCommand = "previewSelectedCodeAction";
var ActionListItemKind = /* @__PURE__ */ ((ActionListItemKind2) => {
  ActionListItemKind2["Action"] = "action";
  ActionListItemKind2["Header"] = "header";
  ActionListItemKind2["Separator"] = "separator";
  return ActionListItemKind2;
})(ActionListItemKind || {});
class HeaderRenderer {
  get templateId() {
    return "header" /* Header */;
  }
  renderTemplate(container) {
    container.classList.add("group-header");
    const text = document.createElement("span");
    container.append(text);
    return { container, text };
  }
  renderElement(element, _index, templateData) {
    templateData.text.textContent = element.group?.title ?? element.label ?? "";
  }
  disposeTemplate(_templateData) {
  }
}
class SeparatorRenderer {
  get templateId() {
    return "separator" /* Separator */;
  }
  renderTemplate(container) {
    container.classList.add("separator");
    const text = document.createElement("span");
    container.append(text);
    return { container, text };
  }
  renderElement(element, _index, templateData) {
    templateData.text.textContent = element.label ?? "";
  }
  disposeTemplate(_templateData) {
  }
}
let ActionItemRenderer = class {
  constructor(_supportsPreview, _onRemoveItem, _onShowSubmenu, _hasAnySubmenuActions, _groupTitleByIndex, _linkHandler, _hideDefaultKeybindingTooltip, _keybindingService, _openerService) {
    this._supportsPreview = _supportsPreview;
    this._onRemoveItem = _onRemoveItem;
    this._onShowSubmenu = _onShowSubmenu;
    this._hasAnySubmenuActions = _hasAnySubmenuActions;
    this._groupTitleByIndex = _groupTitleByIndex;
    this._linkHandler = _linkHandler;
    this._hideDefaultKeybindingTooltip = _hideDefaultKeybindingTooltip;
    this._keybindingService = _keybindingService;
    this._openerService = _openerService;
  }
  get templateId() {
    return "action" /* Action */;
  }
  renderTemplate(container) {
    container.classList.add(this.templateId);
    const icon = document.createElement("div");
    icon.className = "icon";
    container.append(icon);
    const text = document.createElement("span");
    text.className = "title";
    container.append(text);
    const badge = document.createElement("span");
    badge.className = "action-item-badge";
    container.append(badge);
    const description = document.createElement("span");
    description.className = "description";
    container.append(description);
    const groupTitle = document.createElement("span");
    groupTitle.className = "group-title";
    container.append(groupTitle);
    const detail = document.createElement("span");
    detail.className = "detail";
    container.append(detail);
    const keybinding = new KeybindingLabel(container, OS);
    const toolbar = document.createElement("div");
    toolbar.className = "action-list-item-toolbar";
    container.append(toolbar);
    const submenuIndicator = document.createElement("div");
    submenuIndicator.className = "action-list-submenu-indicator";
    container.append(submenuIndicator);
    const inlineToggleContainer = document.createElement("div");
    inlineToggleContainer.className = "action-list-item-inline-toggle";
    container.append(inlineToggleContainer);
    const elementDisposables = new DisposableStore();
    return { container, icon, text, detail, badge, description, groupTitle, keybinding, toolbar, submenuIndicator, inlineToggleContainer, elementDisposables };
  }
  renderElement(element, _index, data) {
    data.elementDisposables.clear();
    if (element.group?.icon) {
      data.icon.className = ThemeIcon.asClassName(element.group.icon);
      if (element.group.icon.color) {
        data.icon.style.color = asCssVariable(element.group.icon.color.id);
      }
    } else {
      data.icon.className = ThemeIcon.asClassName(Codicon.lightBulb);
      data.icon.style.color = "var(--vscode-editorLightBulb-foreground)";
    }
    if (!element.item || !element.label) {
      return;
    }
    dom.setVisibility(!element.hideIcon, data.icon);
    if (element.isSectionToggle) {
      const expanded = element.group?.icon === Codicon.chevronDown;
      data.container.setAttribute("aria-expanded", String(expanded));
    } else {
      data.container.removeAttribute("aria-expanded");
    }
    if (data.previousClassName) {
      data.container.classList.remove(data.previousClassName);
    }
    data.container.classList.toggle("action-list-custom", !!element.className);
    if (element.className) {
      data.container.classList.add(element.className);
    }
    data.previousClassName = element.className;
    data.text.textContent = stripNewlines(element.label);
    if (element.badge) {
      data.badge.textContent = element.badge;
      data.badge.style.display = "";
    } else {
      data.badge.textContent = "";
      data.badge.style.display = "none";
    }
    if (element.keybinding) {
      data.description.textContent = element.keybinding.getLabel();
      data.description.style.display = "inline";
      data.description.style.letterSpacing = "0.5px";
    } else if (element.description) {
      dom.clearNode(data.description);
      if (typeof element.description === "string") {
        data.description.textContent = stripNewlines(element.description);
      } else {
        const rendered = renderMarkdown(element.description, {
          actionHandler: (content) => {
            const uri = URI.parse(content);
            if (this._linkHandler) {
              this._linkHandler(uri, element);
            } else {
              void this._openerService.open(uri, { allowCommands: true });
            }
          }
        });
        data.elementDisposables.add(rendered);
        data.description.appendChild(rendered.element);
      }
      data.description.style.display = "inline";
    } else {
      data.description.textContent = "";
      data.description.style.display = "none";
    }
    const groupTitleText = this._groupTitleByIndex.get(_index);
    if (groupTitleText) {
      data.groupTitle.textContent = groupTitleText;
      data.groupTitle.style.display = "";
    } else {
      data.groupTitle.textContent = "";
      data.groupTitle.style.display = "none";
    }
    if (element.detail) {
      data.detail.textContent = stripNewlines(element.detail);
      data.detail.style.display = "";
    } else {
      data.detail.textContent = "";
      data.detail.style.display = "none";
    }
    dom.clearNode(data.inlineToggleContainer);
    if (element.inlineToggle) {
      const inlineToggle = element.inlineToggle;
      const toggleLabel = document.createElement("span");
      toggleLabel.className = "action-list-item-inline-toggle-label";
      toggleLabel.textContent = stripNewlines(inlineToggle.label);
      data.inlineToggleContainer.append(toggleLabel);
      data.inlineToggleContainer.style.display = "";
      data.container.classList.add("has-inline-toggle");
      const toggle = data.elementDisposables.add(new Toggle({
        title: inlineToggle.title ?? inlineToggle.label,
        isChecked: inlineToggle.checked,
        actionClassName: "action-list-inline-switch",
        notFocusable: false,
        inputActiveOptionBorder: void 0,
        inputActiveOptionForeground: void 0,
        inputActiveOptionBackground: void 0
      }));
      data.inlineToggleContainer.append(toggle.domNode);
      data.elementDisposables.add(toggle.onChange(() => inlineToggle.onChange(toggle.checked)));
      data.elementDisposables.add(dom.addDisposableListener(data.inlineToggleContainer, dom.EventType.CLICK, (e) => e.stopPropagation()));
    } else {
      data.inlineToggleContainer.style.display = "none";
      data.container.classList.remove("has-inline-toggle");
    }
    const actionTitle = this._keybindingService.lookupKeybinding(acceptSelectedActionCommand)?.getLabel();
    const previewTitle = this._keybindingService.lookupKeybinding(previewSelectedActionCommand)?.getLabel();
    data.container.classList.toggle("option-disabled", !!element.disabled);
    if (element.hover !== void 0) {
      data.container.title = "";
    } else if (element.tooltip) {
      data.container.title = element.tooltip;
    } else if (element.disabled) {
      data.container.title = element.label;
    } else if (this._hideDefaultKeybindingTooltip) {
      data.container.title = "";
    } else if (actionTitle && previewTitle) {
      if (this._supportsPreview && element.canPreview) {
        data.container.title = localize({ key: "label-preview", comment: ['placeholders are keybindings, e.g "F2 to Apply, Shift+F2 to Preview"'] }, "{0} to Apply, {1} to Preview", actionTitle, previewTitle);
      } else {
        data.container.title = localize({ key: "label", comment: ['placeholder is a keybinding, e.g "F2 to Apply"'] }, "{0} to Apply", actionTitle);
      }
    } else {
      data.container.title = "";
    }
    dom.clearNode(data.toolbar);
    const toolbarActions = [...element.toolbarActions ?? []];
    if (element.onRemove) {
      toolbarActions.push(toAction({
        id: "actionList.remove",
        label: localize("actionList.remove", "Remove"),
        class: ThemeIcon.asClassName(Codicon.close),
        run: async () => {
          await element.onRemove();
          this._onRemoveItem?.(element);
        }
      }));
    }
    data.container.classList.toggle("has-toolbar", toolbarActions.length > 0);
    if (toolbarActions.length > 0) {
      const actionBar = new ActionBar(data.toolbar);
      data.elementDisposables.add(actionBar);
      actionBar.push(toolbarActions, { icon: true, label: false });
    }
    if (element.submenuActions?.length && !element.hover?.content) {
      data.submenuIndicator.className = "action-list-submenu-indicator has-submenu " + ThemeIcon.asClassName(Codicon.chevronRight);
      data.submenuIndicator.style.display = "";
      data.submenuIndicator.style.visibility = "";
      data.elementDisposables.add(dom.addDisposableListener(data.submenuIndicator, dom.EventType.CLICK, (e) => {
        e.stopPropagation();
        this._onShowSubmenu?.(element);
      }));
    } else if (this._hasAnySubmenuActions) {
      data.submenuIndicator.className = "action-list-submenu-indicator";
      data.submenuIndicator.style.display = "";
      data.submenuIndicator.style.visibility = "hidden";
    } else {
      data.submenuIndicator.className = "action-list-submenu-indicator";
      data.submenuIndicator.style.display = "none";
    }
  }
  disposeTemplate(templateData) {
    templateData.keybinding.dispose();
    templateData.elementDisposables.dispose();
  }
};
ActionItemRenderer = __decorateClass([
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IOpenerService)
], ActionItemRenderer);
class AcceptSelectedEvent extends UIEvent {
  constructor() {
    super("acceptSelectedAction");
  }
}
class PreviewSelectedEvent extends UIEvent {
  constructor() {
    super("previewSelectedAction");
  }
}
function getKeyboardNavigationLabel(item) {
  if (item.kind === "action") {
    return item.label;
  }
  return void 0;
}
let ActionListWidget = class extends Disposable {
  constructor(user, _supportsPreview, items, _delegate, accessibilityProvider, _options, _keybindingService, _openerService, _instantiationService) {
    super();
    this._supportsPreview = _supportsPreview;
    this._delegate = _delegate;
    this._options = _options;
    this._keybindingService = _keybindingService;
    this._openerService = _openerService;
    this._instantiationService = _instantiationService;
    this._headerLineHeight = 24;
    this._separatorLineHeight = 8;
    this.cts = this._register(new CancellationTokenSource());
    this._submenuDisposables = this._register(new DisposableStore());
    this._collapsedSections = /* @__PURE__ */ new Set();
    this._filterText = "";
    this._imeSessionInProgress = false;
    this._suppressHover = false;
    this._hasLaidOut = false;
    this._filterCts = this._register(new MutableDisposable());
    this._groupTitleByIndex = /* @__PURE__ */ new Map();
    this._onDidRequestLayout = this._register(new Emitter());
    /**
     * Fired when the widget's visible item set changes and the parent should
     * re-layout (e.g. after filtering or collapsing a section).
     */
    this.onDidRequestLayout = this._onDidRequestLayout.event;
    this.domNode = document.createElement("div");
    this.domNode.classList.add("actionList");
    if (this._options?.inlineDescription) {
      this.domNode.classList.add("inline-description");
    }
    if (this._options?.className) {
      const classNames = this._options.className.split(/\s+/).filter((className) => className.length > 0);
      if (classNames.length > 0) {
        this.domNode.classList.add(...classNames);
      }
    }
    this._actionLineHeight = 24;
    this._submenuContainer = document.createElement("div");
    this._submenuContainer.className = "action-list-submenu-panel action-widget";
    this._submenuContainer.style.display = "none";
    this._submenuContainer.tabIndex = -1;
    this.domNode.append(this._submenuContainer);
    this._register(dom.addDisposableListener(this._submenuContainer, "mouseenter", () => {
      this._cancelSubmenuHide();
    }));
    this._register(dom.addDisposableListener(this._submenuContainer, "mouseleave", () => {
      this._scheduleSubmenuHide();
    }));
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.MOUSE_LEAVE, () => {
      this._cancelSubmenuShow();
    }));
    this._register(toDisposable(() => {
      this._cancelSubmenuHide();
      this._cancelSubmenuShow();
    }));
    if (this._options?.collapsedByDefault) {
      for (const section of this._options.collapsedByDefault) {
        this._collapsedSections.add(section);
      }
    }
    const virtualDelegate = {
      getHeight: (element) => {
        return this._getItemHeight(element);
      },
      getTemplateId: (element) => element.kind
    };
    const reserveSubmenuSpace = this._options?.reserveSubmenuSpace ?? true;
    const hasAnySubmenuActions = reserveSubmenuSpace && items.some((item) => !!item.submenuActions?.length && !item.hover?.content);
    this._list = this._register(new List(user, this.domNode, virtualDelegate, [
      new ActionItemRenderer(this._supportsPreview, (item) => this._removeItem(item), (item) => this._showSubmenuForItem(item), hasAnySubmenuActions, this._groupTitleByIndex, this._options?.linkHandler, this._options?.hideDefaultKeybindingTooltip ?? false, this._keybindingService, this._openerService),
      new HeaderRenderer(),
      new SeparatorRenderer()
    ], {
      keyboardSupport: false,
      typeNavigationEnabled: !this._options?.showFilter,
      keyboardNavigationLabelProvider: { getKeyboardNavigationLabel },
      accessibilityProvider: {
        getAriaLabel: (element) => {
          if (element.kind === "action" /* Action */) {
            let label = element.label ? stripNewlines(element?.label) : "";
            if (element.detail) {
              label = label + ", " + stripNewlines(element.detail);
            }
            if (element.ariaDescription) {
              label = label + ", " + stripNewlines(element.ariaDescription);
            } else if (element.description) {
              const descText = typeof element.description === "string" ? element.description : element.description.value;
              label = label + ", " + stripNewlines(descText);
            }
            if (element.hover?.content && !element.ariaDescription && !element.description) {
              const hoverContent = element.hover.content;
              const hoverText = typeof hoverContent === "string" ? hoverContent : isMarkdownString(hoverContent) ? hoverContent.value : dom.isHTMLElement(hoverContent) ? hoverContent.textContent ?? void 0 : void 0;
              if (hoverText && (!element.detail || stripNewlines(element.detail) !== stripNewlines(hoverText))) {
                label = label + ", " + stripNewlines(hoverText);
              }
            }
            if (element.group?.title) {
              label = label + ", " + element.group.title;
            }
            if (element.inlineToggle) {
              label = label + ", " + (element.inlineToggle.checked ? localize("actionList.inlineToggle.on", "{0}, on", element.inlineToggle.label) : localize("actionList.inlineToggle.off", "{0}, off", element.inlineToggle.label));
            }
            if (element.disabled) {
              label = localize({ key: "customQuickFixWidget.labels", comment: [`Action widget labels for accessibility.`] }, "{0}, Disabled Reason: {1}", label, element.disabled);
            }
            if (element.submenuActions?.length) {
              label = localize("actionList.submenuHint", "{0}, use right arrow to access options", label);
            }
            return label;
          }
          return null;
        },
        getWidgetAriaLabel: () => localize({ key: "customQuickFixWidget", comment: [`An action widget option`] }, "Action Widget"),
        getRole: (e) => {
          switch (e.kind) {
            case "action" /* Action */:
              return "option";
            case "separator" /* Separator */:
              return "separator";
            default:
              return "separator";
          }
        },
        getWidgetRole: () => "listbox",
        ...accessibilityProvider
      }
    }));
    this._list.style(defaultListStyles);
    this._register(this._list.onMouseClick((e) => this.onListClick(e)));
    this._register(this._list.onMouseOver((e) => this.onListHover(e)));
    this._register(this._list.onDidChangeFocus(() => this.onFocus()));
    this._register(this._list.onDidChangeSelection((e) => this.onListSelection(e)));
    this._allMenuItems = [...items];
    if (this._options?.showFilter || this._options?.secondaryHeading) {
      this._filterContainer = document.createElement("div");
      this._filterContainer.className = "action-list-filter";
      const filterRow = dom.append(this._filterContainer, dom.$(".action-list-filter-row"));
      if (this._options?.showFilter) {
        this._filterInput = document.createElement("input");
        this._filterInput.type = "text";
        this._filterInput.className = "action-list-filter-input";
        this._filterInput.placeholder = this._options?.filterPlaceholder ?? localize("actionList.filter.placeholder", "Search...");
        this._filterInput.setAttribute("aria-label", localize("actionList.filter.ariaLabel", "Filter items"));
        filterRow.appendChild(this._filterInput);
        const filterActions = this._options?.filterActions ?? [];
        if (filterActions.length > 0) {
          const filterActionsContainer = dom.append(filterRow, dom.$(".action-list-filter-actions"));
          const filterActionBar = this._register(new ActionBar(filterActionsContainer));
          filterActionBar.push(filterActions, { icon: true, label: false });
        }
        const onFilterValueChanged = () => {
          const value = this._filterInput.value;
          if (this._imeSessionInProgress || value === this._filterText) {
            return;
          }
          this._filterText = value;
          this._applyOrUpdateFilter();
        };
        this._register(dom.addDisposableListener(this._filterInput, "compositionstart", () => {
          this._imeSessionInProgress = true;
          this._filterCts.value?.cancel();
        }));
        this._register(dom.addDisposableListener(this._filterInput, "compositionend", () => {
          this._imeSessionInProgress = false;
          onFilterValueChanged();
        }));
        this._register(dom.addDisposableListener(this._filterInput, "input", onFilterValueChanged));
      }
      if (this._options?.secondaryHeading) {
        const filterLabelEl = dom.append(filterRow, dom.$(".action-list-filter-label"));
        filterLabelEl.textContent = this._options.secondaryHeading;
      }
    }
    if (this._options?.footerText) {
      this._footerContainer = document.createElement("div");
      this._footerContainer.className = "action-list-footer";
      this._footerContainer.textContent = this._options.footerText;
    }
    if (this._options?.headerText) {
      this._headerContainer = document.createElement("div");
      this._headerContainer.className = "action-list-header";
      if (this._options.headerIcon) {
        const icon = dom.append(this._headerContainer, dom.$("span.action-list-header-icon"));
        icon.classList.add(...ThemeIcon.asClassNameArray(this._options.headerIcon));
        icon.setAttribute("aria-hidden", "true");
      }
      const text = dom.append(this._headerContainer, dom.$("span.action-list-header-text"));
      text.textContent = this._options.headerText;
      this._register(dom.addDisposableListener(this._headerContainer, dom.EventType.MOUSE_ENTER, () => this._hideSubmenu()));
      if (this._options.headerLink) {
        const { label, uri } = this._options.headerLink;
        text.textContent += " ";
        this._register(this._instantiationService.createInstance(Link, text, { label, href: uri.toString(true) }, {}));
      }
      if (this._options.headerDismiss) {
        const onDismiss = this._options.headerDismiss;
        const dismissButton = dom.append(this._headerContainer, dom.$("span.action-list-header-dismiss"));
        dismissButton.appendChild(dom.$(ThemeIcon.asCSSSelector(Codicon.close)));
        dismissButton.tabIndex = 0;
        dismissButton.setAttribute("role", "button");
        dismissButton.setAttribute("aria-label", localize("actionList.header.dismiss", "Dismiss"));
        const dismiss = () => {
          onDismiss();
          this.focus();
          this._headerContainer?.remove();
          this._headerContainer = void 0;
          this._onDidRequestLayout.fire();
        };
        this._register(dom.addDisposableGenericMouseUpListener(dismissButton, () => dismiss()));
        this._register(dom.addDisposableListener(dismissButton, dom.EventType.KEY_DOWN, (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            dismiss();
          }
        }));
      }
    }
    this._applyFilter();
    if (this._list.length) {
      this._focusCheckedOrFirst();
    }
    this._register(dom.addDisposableListener(this.domNode, "keydown", (e) => {
      if (e.key === "ArrowRight" && !e.isComposing) {
        const focused = this._list.getFocus();
        if (focused.length > 0) {
          const element = this._list.element(focused[0]);
          if (element?.submenuActions?.length) {
            dom.EventHelper.stop(e, true);
            const rowElement = this._getRowElement(focused[0]);
            if (rowElement) {
              this._showSubmenuForElement(element, rowElement);
              this._currentSubmenuWidget?.focus();
            }
          }
        }
      }
    }));
    if (this._filterInput) {
      this._register(dom.addDisposableListener(this.domNode, "keydown", (e) => {
        if (this._filterInput && !dom.isActiveElement(this._filterInput) && !e.isComposing && e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
          this._filterInput.focus();
          this._filterInput.value = e.key;
          this._filterText = e.key;
          this._applyOrUpdateFilter();
          e.preventDefault();
          e.stopPropagation();
        }
      }));
    }
  }
  _toggleSection(section) {
    if (this._collapsedSections.has(section)) {
      this._collapsedSections.delete(section);
    } else {
      this._collapsedSections.add(section);
    }
    this._options?.onDidToggleSection?.(section, this._collapsedSections.has(section));
    this._applyFilter();
  }
  _applyOrUpdateFilter() {
    if (!this._delegate.onFilter) {
      this._applyFilter();
      return;
    }
    const filterText = this._filterText;
    this._filterCts.value?.cancel();
    const cts = new CancellationTokenSource();
    this._filterCts.value = cts;
    this._delegate.onFilter(filterText, cts.token).then((items) => {
      if (cts.token.isCancellationRequested) {
        return;
      }
      this._allMenuItems = [...items];
      this._applyFilter(true);
    }).catch(() => {
    });
  }
  _applyFilter(skipTextFilter = false, fireLayout = true) {
    const filterLower = skipTextFilter ? "" : this._filterText.toLowerCase();
    const isFiltering = !skipTextFilter && filterLower.length > 0;
    const visible = [];
    const focusedIndexes = this._list.getFocus();
    let focusedItem;
    if (focusedIndexes.length > 0) {
      focusedItem = this._list.element(focusedIndexes[0]);
    }
    if (isFiltering) {
      let pendingSeparator;
      let filteredSectionItems = [];
      let hasMatchingActionInSection = false;
      const flushFilteredSection = () => {
        if (pendingSeparator && hasMatchingActionInSection) {
          visible.push(pendingSeparator);
        }
        visible.push(...filteredSectionItems);
        pendingSeparator = void 0;
        filteredSectionItems = [];
        hasMatchingActionInSection = false;
      };
      const matchesFilter = (item) => {
        const label = (item.label ?? "").toLowerCase();
        const descValue = typeof item.description === "string" ? item.description : item.description?.value ?? "";
        return label.includes(filterLower) || descValue.toLowerCase().includes(filterLower);
      };
      for (const item of this._allMenuItems) {
        if (item.kind === "header" /* Header */) {
          continue;
        }
        if (item.kind === "separator" /* Separator */) {
          flushFilteredSection();
          pendingSeparator = item.label ? item : void 0;
          continue;
        }
        if (item.showAlways) {
          filteredSectionItems.push(item);
          continue;
        }
        if (item.isSectionToggle) {
          continue;
        }
        if (matchesFilter(item)) {
          hasMatchingActionInSection = true;
          filteredSectionItems.push(item);
        }
      }
      flushFilteredSection();
    } else {
      for (const item of this._allMenuItems) {
        if (item.kind === "header" /* Header */) {
          visible.push(item);
          continue;
        }
        if (item.kind === "separator" /* Separator */) {
          if (item.section && this._collapsedSections.has(item.section)) {
            continue;
          }
          visible.push(item);
          continue;
        }
        if (item.isSectionToggle && item.section) {
          const collapsed = this._collapsedSections.has(item.section);
          visible.push({
            ...item,
            group: { ...item.group, icon: collapsed ? Codicon.chevronRight : Codicon.chevronDown }
          });
          continue;
        }
        if (item.section && this._collapsedSections.has(item.section)) {
          continue;
        }
        visible.push(item);
      }
    }
    const hasActionBefore = [];
    let seenAction = false;
    for (let i = 0; i < visible.length; i++) {
      hasActionBefore[i] = seenAction;
      if (visible[i].kind === "action" /* Action */) {
        seenAction = true;
      }
    }
    const hasActionBeforeNextSeparator = [];
    let seenActionInSection = false;
    for (let i = visible.length - 1; i >= 0; i--) {
      if (visible[i].kind === "action" /* Action */) {
        seenActionInSection = true;
        continue;
      }
      if (visible[i].kind !== "separator" /* Separator */) {
        continue;
      }
      hasActionBeforeNextSeparator[i] = seenActionInSection;
      seenActionInSection = false;
    }
    for (let i = visible.length - 1; i >= 0; i--) {
      const item = visible[i];
      if (item.kind !== "separator" /* Separator */) {
        continue;
      }
      const hasFollowingActionInSection = hasActionBeforeNextSeparator[i];
      const isLeadingUnlabeledDivider = !item.label && !hasActionBefore[i];
      if (!hasFollowingActionInSection || isLeadingUnlabeledDivider) {
        visible.splice(i, 1);
      }
    }
    if (this._options?.showGroupTitleOnFirstItem) {
      this._recomputeGroupTitles(visible);
    }
    const filterInputHasFocus = this._filterInput && dom.isActiveElement(this._filterInput);
    this._list.splice(0, this._list.length, visible);
    if (fireLayout) {
      this._onDidRequestLayout.fire();
    }
    if (filterInputHasFocus) {
      this._filterInput?.focus();
      this._focusCheckedOrFirst();
    } else if (this._hasLaidOut) {
      if (focusedItem) {
        const focusedItemId = focusedItem.item?.id;
        if (focusedItemId) {
          for (let i = 0; i < this._list.length; i++) {
            const el = this._list.element(i);
            if (el.item?.id === focusedItemId) {
              this._list.setFocus([i]);
              this._list.reveal(i);
              this._list.domFocus();
              break;
            }
          }
        }
      }
    }
  }
  /**
   * Returns the filter container element, if filter is enabled.
   * The caller is responsible for appending it to the widget DOM.
   */
  get filterContainer() {
    return this._filterContainer;
  }
  get footerContainer() {
    return this._footerContainer;
  }
  get headerContainer() {
    return this._headerContainer;
  }
  get filterInput() {
    return this._filterInput;
  }
  get closeAnimation() {
    return this._options?.closeAnimation;
  }
  focusCondition(element) {
    return !element.disabled && element.kind === "action" /* Action */;
  }
  focus() {
    if (this._filterInput && this._options?.focusFilterOnOpen) {
      this._filterInput.focus();
      this._focusCheckedOrFirst();
      return;
    }
    this._list.domFocus();
    this._focusCheckedOrFirst();
  }
  clearFocus() {
    this._list.setFocus([]);
  }
  getFocusedElement() {
    const focused = this._list.getFocus();
    if (focused.length > 0) {
      return this._list.element(focused[0]);
    }
    return void 0;
  }
  /**
   * Replaces the items in the list in place, preserving the current filter,
   * without closing or repositioning the widget. When {@link focusItemId} is
   * provided, that item ({@link IActionListItem.item}'s `id`) is focused;
   * otherwise the previously focused item is preserved (matched by id).
   */
  updateItems(items, focusItemId) {
    this._allMenuItems = [...items];
    this._applyFilter(false, false);
    if (focusItemId !== void 0) {
      this.focusItemById(focusItemId);
    }
  }
  /**
   * Focuses the item whose {@link IActionListItem.item}'s `id` matches
   * {@link itemId}, without rebuilding the list. Re-applies the focus after the
   * current event so a mouse click's own pointer handling cannot reset it.
   */
  focusItemById(itemId) {
    const focusItem = () => {
      for (let i = 0; i < this._list.length; i++) {
        const el = this._list.element(i);
        if (el.item?.id === itemId) {
          this._list.setFocus([i]);
          this._list.reveal(i);
          this._list.domFocus();
          break;
        }
      }
    };
    focusItem();
    queueMicrotask(() => {
      if (this.domNode.isConnected) {
        focusItem();
      }
    });
  }
  _focusCheckedOrFirst() {
    this._suppressHover = true;
    try {
      for (let i = 0; i < this._list.length; i++) {
        const element = this._list.element(i);
        if (element.kind === "action" /* Action */ && element.item?.checked) {
          this._list.setFocus([i]);
          this._list.reveal(i);
          return;
        }
      }
      this._list.focusFirst(void 0, this.focusCondition);
      const focused = this._list.getFocus();
      if (focused.length > 0) {
        this._list.reveal(focused[0]);
      }
    } finally {
      this._suppressHover = false;
    }
  }
  hide(didCancel) {
    this._delegate.onHide(didCancel);
    this.cts.cancel();
    this._filterCts.value?.cancel();
    this._filterCts.clear();
    this._hideSubmenu();
  }
  clearFilter() {
    if (this._filterInput && this._filterText) {
      this._filterInput.value = "";
      this._filterText = "";
      this._applyOrUpdateFilter();
      return true;
    }
    return false;
  }
  /**
   * Whether this widget uses dynamic height (has filter or collapsible sections).
   */
  get hasDynamicHeight() {
    if (this._options?.showFilter) {
      return true;
    }
    return this._allMenuItems.some((item) => item.isSectionToggle);
  }
  /**
   * The height of a single action row in pixels.
   */
  get lineHeight() {
    return this._actionLineHeight;
  }
  /**
   * Returns the height for an action item, using a taller line height
   * for items with a detail (second line).
   */
  _getItemHeight(item) {
    switch (item.kind) {
      case "header" /* Header */:
        return this._headerLineHeight;
      case "separator" /* Separator */:
        return item.label ? this._actionLineHeight : this._separatorLineHeight;
      default:
        if (item.inlineToggle) {
          return this._options?.inlineToggleItemHeight ?? 70;
        }
        return item.detail ? this._options?.detailItemHeight ?? 48 : this._actionLineHeight;
    }
  }
  /**
   * Computes the total height of all items (including collapsed/filtered items).
   */
  computeFullHeight() {
    let fullHeight = 0;
    for (const item of this._allMenuItems) {
      fullHeight += this._getItemHeight(item);
    }
    return fullHeight;
  }
  /**
   * Computes the total height of visible items in the list.
   */
  computeListHeight() {
    const visibleCount = this._list.length;
    let listHeight = 0;
    for (let i = 0; i < visibleCount; i++) {
      const element = this._list.element(i);
      listHeight += this._getItemHeight(element);
    }
    return listHeight;
  }
  /**
   * Lays out the list widget with the given explicit dimensions.
   */
  layout(height, width) {
    this._hasLaidOut = true;
    this._list.layout(height, width);
    this.domNode.style.height = `${height}px`;
    if (this._filterContainer && this._filterContainer.parentElement) {
      this._filterContainer.parentElement.insertBefore(this._filterContainer, this.domNode);
    }
  }
  computeMaxWidth(minWidth) {
    const visibleCount = this._list.length;
    const effectiveMinWidth = Math.max(minWidth, this._options?.minWidth ?? 0);
    const rawMaxWidthCap = this._options?.maxWidth ?? Number.POSITIVE_INFINITY;
    const maxWidthCap = Math.max(rawMaxWidthCap, effectiveMinWidth);
    const clamp = (w) => Math.min(Math.max(w, effectiveMinWidth), maxWidthCap);
    let maxWidth = effectiveMinWidth;
    const totalItemCount = this._allMenuItems.length;
    if (totalItemCount >= 50) {
      return clamp(380);
    }
    if (totalItemCount > visibleCount) {
      const visibleItems2 = [];
      for (let i = 0; i < visibleCount; i++) {
        visibleItems2.push(this._list.element(i));
      }
      const allItems = [...this._allMenuItems];
      this._list.splice(0, visibleCount, allItems);
      let allItemsHeight = 0;
      for (const item of allItems) {
        allItemsHeight += this._getItemHeight(item);
      }
      this._list.layout(allItemsHeight);
      const itemWidths2 = this._measureItemWidths(allItems);
      maxWidth = clamp(Math.max(...itemWidths2));
      this._list.splice(0, allItems.length, visibleItems2);
      return maxWidth;
    }
    const visibleItems = [];
    for (let i = 0; i < visibleCount; i++) {
      visibleItems.push(this._list.element(i));
    }
    const itemWidths = this._measureItemWidths(visibleItems);
    return clamp(Math.max(...itemWidths));
  }
  focusPrevious() {
    if (this._filterInput && dom.isActiveElement(this._filterInput)) {
      this._list.domFocus();
      const current = this._list.getFocus();
      if (current.length > 0) {
        this._list.focusPrevious(1, false, void 0, this.focusCondition);
        const focused2 = this._list.getFocus();
        if (focused2.length > 0 && focused2[0] >= current[0]) {
          this._filterInput.focus();
        } else if (focused2.length > 0) {
          this._list.reveal(focused2[0]);
        }
      } else {
        this._list.focusLast(void 0, this.focusCondition);
        const focused2 = this._list.getFocus();
        if (focused2.length > 0) {
          this._list.reveal(focused2[0]);
        }
      }
      return;
    }
    const previousFocus = this._list.getFocus();
    this._list.focusPrevious(1, true, void 0, this.focusCondition);
    const focused = this._list.getFocus();
    if (focused.length > 0) {
      if (this._filterInput && previousFocus.length > 0 && focused[0] > previousFocus[0]) {
        this._list.setFocus([]);
        this._filterInput.focus();
        return;
      }
      this._list.reveal(focused[0]);
    }
  }
  focusNext() {
    if (this._filterInput && dom.isActiveElement(this._filterInput)) {
      this._list.domFocus();
      const current = this._list.getFocus();
      if (current.length > 0) {
        this._list.focusNext(1, false, void 0, this.focusCondition);
        const focused2 = this._list.getFocus();
        if (focused2.length > 0) {
          this._list.reveal(focused2[0]);
        }
      } else {
        this._list.focusFirst(void 0, this.focusCondition);
        const focused2 = this._list.getFocus();
        if (focused2.length > 0) {
          this._list.reveal(focused2[0]);
        }
      }
      return;
    }
    const previousFocus = this._list.getFocus();
    this._list.focusNext(1, true, void 0, this.focusCondition);
    const focused = this._list.getFocus();
    if (focused.length > 0) {
      if (this._filterInput && previousFocus.length > 0 && focused[0] < previousFocus[0]) {
        this._list.setFocus([]);
        this._filterInput.focus();
        return;
      }
      this._list.reveal(focused[0]);
    }
  }
  collapseFocusedSection() {
    const section = this._getFocusedSection();
    if (section && !this._collapsedSections.has(section)) {
      this._toggleSection(section);
    }
  }
  expandFocusedSection() {
    const section = this._getFocusedSection();
    if (section && this._collapsedSections.has(section)) {
      this._toggleSection(section);
    }
  }
  toggleFocusedSection() {
    const focused = this._list.getFocus();
    if (focused.length === 0) {
      return false;
    }
    const element = this._list.element(focused[0]);
    if (element.isSectionToggle && element.section) {
      this._toggleSection(element.section);
      return true;
    }
    return false;
  }
  _getFocusedSection() {
    const focused = this._list.getFocus();
    if (focused.length === 0) {
      return void 0;
    }
    const element = this._list.element(focused[0]);
    if (element.isSectionToggle && element.section) {
      return element.section;
    }
    return element.section;
  }
  acceptSelected(preview) {
    const focused = this._list.getFocus();
    if (focused.length === 0) {
      return;
    }
    const focusIndex = focused[0];
    const element = this._list.element(focusIndex);
    if (!this.focusCondition(element)) {
      return;
    }
    const event = preview ? new PreviewSelectedEvent() : new AcceptSelectedEvent();
    this._list.setSelection([focusIndex], event);
  }
  onListSelection(e) {
    if (!e.elements.length) {
      return;
    }
    const element = e.elements[0];
    if (element.isSectionToggle && element.section) {
      this._list.setSelection([]);
      const section = element.section;
      queueMicrotask(() => {
        this._toggleSection(section);
      });
      return;
    }
    if (dom.isMouseEvent(e.browserEvent)) {
      const target = e.browserEvent.target;
      if (dom.isHTMLElement(target) && (target.closest(".action-list-item-toolbar") || target.closest(".action-list-submenu-indicator") || target.closest(".action-list-item-inline-toggle"))) {
        this._list.setSelection([]);
        return;
      }
    }
    if (element.item && this.focusCondition(element)) {
      const isPreviewEvent = e.browserEvent instanceof PreviewSelectedEvent;
      this._delegate.onSelect(element.item, isPreviewEvent && this._supportsPreview);
    } else {
      this._list.setSelection([]);
    }
  }
  onFocus() {
    const focused = this._list.getFocus();
    if (focused.length === 0) {
      return;
    }
    const focusIndex = focused[0];
    const element = this._list.element(focusIndex);
    this._delegate.onFocus?.(element.item);
    if (!this._suppressHover) {
      this._showHoverForElement(element, focusIndex);
    }
  }
  _removeItem(item) {
    const index = this._allMenuItems.indexOf(item);
    if (index >= 0) {
      this._allMenuItems.splice(index, 1);
      this._applyFilter();
    }
  }
  _recomputeGroupTitles(items) {
    this._groupTitleByIndex.clear();
    const seenTitles = /* @__PURE__ */ new Set();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "action" /* Action */ && item.group?.title && !seenTitles.has(item.group.title)) {
        seenTitles.add(item.group.title);
        this._groupTitleByIndex.set(i, item.group.title);
      }
    }
  }
  _measureItemWidths(items) {
    const rows = [];
    for (let i = 0; i < items.length; i++) {
      const element = this._getRowElement(i);
      if (element) {
        element.style.width = "auto";
        rows.push({ element, item: items[i] });
      }
    }
    try {
      return rows.map(({ element, item }) => element.getBoundingClientRect().width + this._computeToolbarWidth(item));
    } finally {
      for (const { element } of rows) {
        element.style.width = "";
      }
    }
  }
  _computeToolbarWidth(item) {
    let actionCount = item.toolbarActions?.length ?? 0;
    if (item.onRemove) {
      actionCount++;
    }
    if (actionCount === 0) {
      return 0;
    }
    const actionButtonWidth = 22;
    return actionCount * actionButtonWidth + 6;
  }
  _getRowElement(index) {
    return this.domNode.ownerDocument.getElementById(this._list.getElementID(index));
  }
  _showHoverForElement(element, index) {
    if (this._currentSubmenuElement === element) {
      return;
    }
    const hasHoverContent = !!element.hover?.content;
    const hasSubmenuActions = !!element.submenuActions?.length;
    if (hasHoverContent || hasSubmenuActions) {
      const rowElement = this._getRowElement(index);
      if (rowElement) {
        this._showSubmenuForElement(element, rowElement);
      }
      return;
    }
    this._hideSubmenu();
  }
  _showSubmenuForItem(item) {
    const index = this._list.indexOf(item);
    if (index >= 0) {
      const rowElement = this._getRowElement(index);
      if (rowElement) {
        this._showSubmenuForElement(item, rowElement);
      }
    }
  }
  _showSubmenuForElement(element, anchor) {
    if (this._currentSubmenuElement === element) {
      return;
    }
    this._submenuDisposables.clear();
    this._currentSubmenuElement = element;
    this._clearSubmenuContainer();
    let hoverHeader;
    const hoverContent = element.hover?.content;
    if (hoverContent) {
      if (dom.isHTMLElement(hoverContent)) {
        hoverHeader = hoverContent;
        if (element.hover?.disposable) {
          this._register(element.hover.disposable);
        }
      } else {
        const markdown = typeof hoverContent === "string" ? new MarkdownString(hoverContent) : hoverContent;
        const linkHandler = this._options?.linkHandler;
        const rendered = renderMarkdown(markdown, {
          actionHandler: (url) => {
            const uri = URI.parse(url);
            if (linkHandler) {
              linkHandler(uri, element);
            } else {
              this._openerService.open(uri, { allowCommands: true });
            }
          }
        });
        this._submenuDisposables.add(rendered);
        hoverHeader = rendered.element;
      }
      hoverHeader.classList.add("action-list-submenu-hover-header");
      if (element.submenuActions?.length) {
        hoverHeader.classList.add("has-submenu");
      }
      this._submenuContainer.appendChild(hoverHeader);
    }
    const hasSubmenuActions = !!element.submenuActions?.length;
    this._submenuContainer.style.display = "";
    this._submenuContainer.style.position = "absolute";
    this._submenuContainer.removeAttribute("role");
    const anchorRect = anchor.getBoundingClientRect();
    const parentRect = this.domNode.getBoundingClientRect();
    const targetWindow = dom.getWindow(this.domNode);
    let totalHeight = 0;
    let maxWidth = hoverHeader ? hoverHeader.offsetWidth : 0;
    if (hasSubmenuActions) {
      const submenuItems = [];
      const submenuGroups = element.submenuActions.filter((a) => a instanceof SubmenuAction);
      const groupsWithActions = submenuGroups.filter((g) => g.actions.length > 0);
      for (let gi = 0; gi < groupsWithActions.length; gi++) {
        const group = groupsWithActions[gi];
        if (group.label) {
          submenuItems.push({
            kind: "header" /* Header */,
            group: { title: group.label },
            label: group.label
          });
        }
        for (let ci = 0; ci < group.actions.length; ci++) {
          const child = group.actions[ci];
          const extendedChild = child;
          const icon = extendedChild.icon ?? ThemeIcon.fromId(child.checked ? Codicon.check.id : Codicon.blank.id);
          const hoverContent2 = extendedChild.hoverContent;
          submenuItems.push({
            item: child,
            kind: "action" /* Action */,
            label: child.label,
            description: child.tooltip || void 0,
            group: { title: "", icon },
            hideIcon: false,
            hover: hoverContent2 ? { content: hoverContent2 } : {},
            onRemove: extendedChild.onRemove
          });
        }
        if (gi < groupsWithActions.length - 1) {
          submenuItems.push({ kind: "separator" /* Separator */, label: "" });
        }
      }
      for (const action of element.submenuActions) {
        if (!(action instanceof SubmenuAction)) {
          const extendedAction = action;
          submenuItems.push({
            item: action,
            kind: "action" /* Action */,
            label: action.label,
            description: action.tooltip || void 0,
            group: { title: "" },
            hideIcon: false,
            hover: {},
            onRemove: extendedAction.onRemove
          });
        }
      }
      const submenuDelegate = {
        onHide: () => {
        },
        onSelect: (action) => {
          action.run();
          const parentItem = this._currentSubmenuElement?.item;
          this._hideSubmenu();
          if (parentItem) {
            this._delegate.onSelect(parentItem);
          }
          this.hide();
        }
      };
      const submenuWidget = this._submenuDisposables.add(this._instantiationService.createInstance(
        ActionListWidget,
        "submenu",
        false,
        submenuItems,
        submenuDelegate,
        void 0,
        void 0
      ));
      this._submenuContainer.appendChild(submenuWidget.domNode);
      this._currentSubmenuWidget = submenuWidget;
      submenuWidget.clearFocus();
      totalHeight = submenuWidget.computeListHeight();
      submenuWidget.layout(totalHeight);
      const submenuMaxWidth = submenuWidget.computeMaxWidth(0);
      maxWidth = Math.max(maxWidth, submenuMaxWidth);
      submenuWidget.layout(totalHeight, maxWidth);
      submenuWidget.domNode.style.width = `${maxWidth}px`;
      this._submenuDisposables.add(dom.addDisposableListener(submenuWidget.domNode, "keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "Escape") {
          dom.EventHelper.stop(e, true);
          this._hideSubmenu();
          this._list.domFocus();
        } else if (e.key === "Enter") {
          dom.EventHelper.stop(e, true);
          const focused = submenuWidget.getFocusedElement();
          if (focused?.item) {
            focused.item.run();
            const parentItem = this._currentSubmenuElement?.item;
            this._hideSubmenu();
            if (parentItem) {
              this._delegate.onSelect(parentItem);
            }
            this.hide();
          }
        } else if (e.key === "ArrowDown") {
          dom.EventHelper.stop(e, true);
          submenuWidget.focusNext();
        } else if (e.key === "ArrowUp") {
          dom.EventHelper.stop(e, true);
          submenuWidget.focusPrevious();
        }
      }));
    }
    const viewportWidth = targetWindow.innerWidth;
    const spaceRight = viewportWidth - anchorRect.right;
    const spaceLeft = parentRect.left;
    const panelWidth = maxWidth + 10;
    const gap = 4;
    if (spaceRight >= panelWidth || spaceRight >= spaceLeft) {
      this._submenuContainer.style.left = `${parentRect.right - parentRect.left + gap}px`;
    } else {
      this._submenuContainer.style.left = `${-panelWidth - gap}px`;
    }
    const hoverHeaderHeight = hoverHeader ? hoverHeader.offsetHeight : 0;
    const totalPanelHeight = totalHeight + hoverHeaderHeight;
    const viewportHeight = targetWindow.innerHeight;
    const anchorHeight = anchorRect.height;
    let top = anchorRect.top - parentRect.top + (anchorHeight - totalPanelHeight) / 2;
    const panelBottom = parentRect.top + top + totalPanelHeight;
    if (panelBottom > viewportHeight) {
      top -= panelBottom - viewportHeight + 8;
    }
    if (parentRect.top + top < 0) {
      top = -parentRect.top;
    }
    this._submenuContainer.style.top = `${top}px`;
  }
  _hideSubmenu() {
    this._cancelSubmenuHide();
    this._cancelSubmenuShow();
    this._submenuDisposables.clear();
    this._currentSubmenuWidget = void 0;
    this._currentSubmenuElement = void 0;
    this._clearSubmenuContainer();
    this._submenuContainer.style.display = "none";
  }
  /**
   * Clears the submenu/hover panel. If focus currently lives inside the panel
   * (e.g. the user clicked a button in the hover content), focus is first moved
   * back to the list. Otherwise clearing the panel would drop focus to <body>,
   * which blurs the action widget and dismisses it.
   */
  _clearSubmenuContainer() {
    if (this._submenuContainer.contains(dom.getActiveElement())) {
      this._list.domFocus();
    }
    dom.clearNode(this._submenuContainer);
  }
  _scheduleSubmenuHide() {
    this._cancelSubmenuHide();
    this._submenuHideTimeout = setTimeout(() => {
      this._hideSubmenu();
    }, 300);
  }
  _cancelSubmenuHide() {
    if (this._submenuHideTimeout !== void 0) {
      clearTimeout(this._submenuHideTimeout);
      this._submenuHideTimeout = void 0;
    }
  }
  _scheduleSubmenuShow(element, index) {
    this._cancelSubmenuShow();
    this._submenuShowTimeout = setTimeout(() => {
      this._submenuShowTimeout = void 0;
      const rowElement = typeof index === "number" ? this._getRowElement(index) : null;
      if (rowElement) {
        this._showSubmenuForElement(element, rowElement);
      }
    }, 500);
  }
  _cancelSubmenuShow() {
    if (this._submenuShowTimeout !== void 0) {
      clearTimeout(this._submenuShowTimeout);
      this._submenuShowTimeout = void 0;
    }
  }
  async onListHover(e) {
    const element = e.element;
    if (element && element.item && this.focusCondition(element)) {
      const isHoveringToolbar = dom.isHTMLElement(e.browserEvent.target) && e.browserEvent.target.closest(".action-list-item-toolbar") !== null;
      if (isHoveringToolbar) {
        if (!element.submenuActions?.length) {
          this._cancelSubmenuShow();
        }
        this._list.setFocus([]);
        return;
      }
      const hasPanel = !!(element.submenuActions?.length || element.hover?.content);
      if (hasPanel) {
        this._suppressHover = true;
      }
      this._list.setFocus(typeof e.index === "number" ? [e.index] : []);
      if (hasPanel) {
        this._suppressHover = false;
      }
      if (hasPanel) {
        if (this._currentSubmenuElement === element) {
          this._cancelSubmenuHide();
          this._cancelSubmenuShow();
        } else {
          this._hideSubmenu();
          this._scheduleSubmenuShow(element, e.index);
        }
        return;
      }
      if (this._currentSubmenuElement === element) {
        this._cancelSubmenuHide();
      } else {
        this._cancelSubmenuShow();
        this._hideSubmenu();
      }
      if (this._delegate.onHover && !element.disabled && element.kind === "action" /* Action */ && this._currentSubmenuElement !== element) {
        const result = await this._delegate.onHover(element.item, this.cts.token);
        const canPreview = result ? result.canPreview : void 0;
        if (canPreview !== element.canPreview) {
          element.canPreview = canPreview;
          if (typeof e.index === "number") {
            this._list.splice(e.index, 1, [element]);
            this._list.setFocus([e.index]);
          }
        }
      }
    } else if (element && element.hover?.content && typeof e.index === "number") {
      if (this._currentSubmenuElement === element) {
        this._cancelSubmenuHide();
        this._cancelSubmenuShow();
      } else {
        this._hideSubmenu();
        this._scheduleSubmenuShow(element, e.index);
      }
    }
  }
  onListClick(e) {
    if (e.element && this.focusCondition(e.element)) {
      this._list.setFocus([]);
    }
  }
};
ActionListWidget = __decorateClass([
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IInstantiationService)
], ActionListWidget);
let ActionList = class extends Disposable {
  constructor(user, preview, items, _delegate, accessibilityProvider, options, anchor, _contextViewService, _layoutService, instantiationService) {
    super();
    this._contextViewService = _contextViewService;
    this._layoutService = _layoutService;
    this._lastMinWidth = 0;
    this._hasLaidOut = false;
    this._anchor = anchor;
    this._preferredAnchorPosition = options?.anchorPosition;
    this._widgetClassName = options?.widgetClassName;
    this._widget = this._register(instantiationService.createInstance(
      ActionListWidget,
      user,
      preview,
      items,
      _delegate,
      accessibilityProvider,
      options
    ));
    this._register(this._widget.onDidRequestLayout(() => {
      if (this._hasLaidOut) {
        this.layout(this._lastMinWidth);
        this._contextViewService.layout();
      }
    }));
  }
  get domNode() {
    return this._widget.domNode;
  }
  get filterContainer() {
    return this._widget.filterContainer;
  }
  get footerContainer() {
    return this._widget.footerContainer;
  }
  get headerContainer() {
    return this._widget.headerContainer;
  }
  get filterInput() {
    return this._widget.filterInput;
  }
  get closeAnimation() {
    return this._widget.closeAnimation;
  }
  get widgetClassName() {
    return this._widgetClassName;
  }
  /**
   * Returns the resolved anchor position after the first layout.
   * Used by the context view delegate to lock the dropdown direction.
   */
  get anchorPosition() {
    if (this._preferredAnchorPosition !== void 0) {
      return this._preferredAnchorPosition;
    }
    if (this._showAbove === void 0) {
      return void 0;
    }
    return this._showAbove ? AnchorPosition.ABOVE : AnchorPosition.BELOW;
  }
  focus() {
    this._widget.focus();
  }
  hide(didCancel, hideContextView = true) {
    this._widget.hide(didCancel);
    if (hideContextView) {
      this._contextViewService.hideContextView();
    }
  }
  clearFilter() {
    return this._widget.clearFilter();
  }
  focusPrevious() {
    this._widget.focusPrevious();
  }
  focusNext() {
    this._widget.focusNext();
  }
  collapseFocusedSection() {
    this._widget.collapseFocusedSection();
  }
  expandFocusedSection() {
    this._widget.expandFocusedSection();
  }
  toggleFocusedSection() {
    return this._widget.toggleFocusedSection();
  }
  acceptSelected(preview) {
    this._widget.acceptSelected(preview);
  }
  updateItems(items, focusItemId) {
    this._widget.updateItems(items, focusItemId);
  }
  focusItemById(itemId) {
    this._widget.focusItemById(itemId);
  }
  hasDynamicHeight() {
    return this._widget.hasDynamicHeight;
  }
  computeActionWidgetVerticalChromeHeight() {
    const widgetContainer = this.domNode.parentElement?.closest(".action-widget");
    if (!widgetContainer) {
      return 0;
    }
    const style = dom.getWindow(widgetContainer).getComputedStyle(widgetContainer);
    const toPixels = (value) => Number.parseFloat(value) || 0;
    return toPixels(style.paddingTop) + toPixels(style.paddingBottom) + toPixels(style.borderTopWidth) + toPixels(style.borderBottomWidth);
  }
  computeHeight() {
    const listHeight = this._widget.computeListHeight();
    const filterHeight = this._widget.filterContainer ? 36 : 0;
    const footerHeight = this._widget.footerContainer ? 32 : 0;
    const headerHeight = this._widget.headerContainer ? this._widget.headerContainer.offsetHeight || 36 : 0;
    const chromeHeight = filterHeight + footerHeight + headerHeight;
    const targetWindow = dom.getWindow(this.domNode);
    let availableHeight;
    if (this.hasDynamicHeight() || this._preferredAnchorPosition !== void 0) {
      const viewportHeight = targetWindow.innerHeight;
      const anchorRect = getAnchorRect(this._anchor);
      const anchorTopInViewport = anchorRect.top - targetWindow.pageYOffset;
      const bottomGap = 30;
      const spaceBelow = viewportHeight - anchorTopInViewport - anchorRect.height - bottomGap;
      const spaceAbove = anchorTopInViewport;
      if (this._showAbove === void 0) {
        this._showAbove = this._preferredAnchorPosition !== void 0 ? this._preferredAnchorPosition === AnchorPosition.ABOVE : chromeHeight + this._widget.computeFullHeight() > spaceBelow && spaceAbove > spaceBelow;
      }
      availableHeight = Math.max(0, (this._showAbove ? spaceAbove : spaceBelow) - this.computeActionWidgetVerticalChromeHeight());
    } else {
      const padding = 10;
      const windowHeight = this._layoutService.getContainer(targetWindow).clientHeight;
      const widgetTop = this.domNode.getBoundingClientRect().top;
      availableHeight = widgetTop > 0 ? windowHeight - widgetTop - padding : windowHeight * 0.7;
    }
    const viewportMaxHeight = Math.floor(targetWindow.innerHeight * 0.6);
    const actionLineHeight = this._widget.lineHeight;
    if (this._preferredAnchorPosition !== void 0) {
      const maxHeight2 = Math.min(availableHeight, viewportMaxHeight);
      const height2 = Math.min(listHeight + chromeHeight, Math.max(0, maxHeight2));
      return Math.max(0, height2 - chromeHeight);
    }
    const maxHeight = Math.min(Math.max(availableHeight, actionLineHeight * 3 + chromeHeight), viewportMaxHeight);
    const height = Math.min(listHeight + chromeHeight, maxHeight);
    return height - chromeHeight;
  }
  layout(minWidth) {
    this._hasLaidOut = true;
    this._lastMinWidth = minWidth;
    const listHeight = this.computeHeight();
    this._widget.layout(listHeight);
    const computedWidth = this._widget.computeMaxWidth(minWidth);
    this._cachedMaxWidth = computedWidth;
    this._widget.layout(listHeight, this._cachedMaxWidth);
    return this._cachedMaxWidth;
  }
};
ActionList = __decorateClass([
  __decorateParam(7, IContextViewService),
  __decorateParam(8, ILayoutService),
  __decorateParam(9, IInstantiationService)
], ActionList);
function stripNewlines(str) {
  return str.replace(/\r\n|\r|\n/g, " ");
}
export {
  ActionList,
  ActionListItemKind,
  ActionListWidget,
  acceptSelectedActionCommand,
  previewSelectedActionCommand
};
