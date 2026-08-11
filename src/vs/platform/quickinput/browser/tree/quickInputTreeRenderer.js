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
import * as cssJs from "../../../../base/browser/cssValue.js";
import * as dom from "../../../../base/browser/dom.js";
import { ToolBar } from "../../../../base/browser/ui/toolbar/toolbar.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { createToggleActionViewItemProvider, TriStateCheckbox } from "../../../../base/browser/ui/toggle/toggle.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IContextMenuService } from "../../../contextview/browser/contextView.js";
import { defaultCheckboxStyles } from "../../../theme/browser/defaultStyles.js";
import { isDark } from "../../../theme/common/theme.js";
import { escape } from "../../../../base/common/strings.js";
import { IThemeService } from "../../../theme/common/themeService.js";
import { quickInputButtonsToActionArrays } from "../quickInputUtils.js";
const $ = dom.$;
class QuickInputCheckboxStateHandler extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidChangeCheckboxState = this._register(new Emitter());
    this.onDidChangeCheckboxState = this._onDidChangeCheckboxState.event;
  }
  setCheckboxState(node, checked) {
    this._onDidChangeCheckboxState.fire({ item: node, checked });
  }
}
let QuickInputTreeRenderer = class extends Disposable {
  constructor(_hoverDelegate, _buttonTriggeredEmitter, onCheckedEvent, _checkboxStateHandler, _toggleStyles, _contextMenuService, _themeService) {
    super();
    this._hoverDelegate = _hoverDelegate;
    this._buttonTriggeredEmitter = _buttonTriggeredEmitter;
    this.onCheckedEvent = onCheckedEvent;
    this._checkboxStateHandler = _checkboxStateHandler;
    this._toggleStyles = _toggleStyles;
    this._contextMenuService = _contextMenuService;
    this._themeService = _themeService;
    this.templateId = QuickInputTreeRenderer.ID;
    this._onDidDisposeFocusedElement = this._register(new Emitter());
    /**
     * This event is emitted when the renderer disposes an element that has focus.
     * This allows the list to re-focus itself and prevent focus from being lost
     * (potentially causing quickinput to dismiss itself) when an element is
     * removed while focused.
     */
    this.onDidDisposeFocusedElement = this._onDidDisposeFocusedElement.event;
  }
  static {
    this.ID = "quickInputTreeElement";
  }
  renderTemplate(container) {
    const store = new DisposableStore();
    const entry = dom.append(container, $(".quick-input-tree-entry"));
    const checkbox = store.add(new TriStateCheckbox("", false, { ...defaultCheckboxStyles, size: 15 }));
    entry.appendChild(checkbox.domNode);
    const checkboxLabel = dom.append(entry, $("label.quick-input-tree-label"));
    const rows = dom.append(checkboxLabel, $(".quick-input-tree-rows"));
    const row1 = dom.append(rows, $(".quick-input-tree-row"));
    const icon = dom.prepend(row1, $(".quick-input-tree-icon"));
    const label = store.add(new IconLabel(row1, {
      supportHighlights: true,
      supportDescriptionHighlights: true,
      supportIcons: true,
      hoverDelegate: this._hoverDelegate
    }));
    const actionBar = store.add(new ToolBar(entry, this._contextMenuService, {
      actionViewItemProvider: createToggleActionViewItemProvider(this._toggleStyles),
      hoverDelegate: this._hoverDelegate,
      icon: true,
      label: false
    }));
    actionBar.getElement().classList.add("quick-input-tree-entry-action-bar");
    return {
      toDisposeTemplate: store,
      entry,
      checkbox,
      icon,
      label,
      actionBar,
      toDisposeElement: new DisposableStore()
    };
  }
  renderElement(node, _index, templateData, _details) {
    const store = templateData.toDisposeElement;
    const quickTreeItem = node.element;
    if (quickTreeItem.pickable === false) {
      templateData.checkbox.domNode.style.display = "none";
    } else {
      const checkbox = templateData.checkbox;
      checkbox.domNode.style.display = "";
      checkbox.checked = quickTreeItem.checked ?? false;
      store.add(Event.filter(this.onCheckedEvent, (e) => e.item === quickTreeItem)((e) => checkbox.checked = e.checked));
      if (quickTreeItem.disabled) {
        checkbox.disable();
      }
      store.add(checkbox.onChange((e) => this._checkboxStateHandler.setCheckboxState(quickTreeItem, checkbox.checked)));
    }
    if (quickTreeItem.iconPath) {
      const icon = isDark(this._themeService.getColorTheme().type) ? quickTreeItem.iconPath.dark : quickTreeItem.iconPath.light ?? quickTreeItem.iconPath.dark;
      const iconUrl = URI.revive(icon);
      templateData.icon.className = "quick-input-tree-icon";
      templateData.icon.style.backgroundImage = cssJs.asCSSUrl(iconUrl);
    } else {
      templateData.icon.style.backgroundImage = "";
      templateData.icon.className = quickTreeItem.iconClass ? `quick-input-tree-icon ${quickTreeItem.iconClass}` : "";
    }
    const { labelHighlights: matches, descriptionHighlights: descriptionMatches } = node.filterData || {};
    let descriptionTitle;
    if (quickTreeItem.description) {
      descriptionTitle = {
        markdown: {
          value: escape(quickTreeItem.description),
          supportThemeIcons: true
        },
        markdownNotSupportedFallback: quickTreeItem.description
      };
    }
    templateData.label.setLabel(
      quickTreeItem.label,
      quickTreeItem.description,
      {
        matches,
        descriptionMatches,
        extraClasses: quickTreeItem.iconClasses,
        italic: quickTreeItem.italic,
        strikethrough: quickTreeItem.strikethrough,
        labelEscapeNewLines: true,
        descriptionTitle
      }
    );
    const buttons = quickTreeItem.buttons;
    if (buttons && buttons.length) {
      const { primary, secondary } = quickInputButtonsToActionArrays(
        buttons,
        "quick-input-tree",
        (button) => this._buttonTriggeredEmitter.fire({ item: quickTreeItem, button })
      );
      templateData.actionBar.setActions(primary, secondary);
      templateData.entry.classList.add("has-actions");
    } else {
      templateData.actionBar.setActions([]);
      templateData.entry.classList.remove("has-actions");
    }
  }
  disposeElement(_element, _index, templateData, _details) {
    if (dom.isAncestorOfActiveElement(templateData.entry)) {
      this._onDidDisposeFocusedElement.fire();
    }
    templateData.toDisposeElement.clear();
    templateData.actionBar.setActions([]);
  }
  disposeTemplate(templateData) {
    templateData.toDisposeElement.dispose();
    templateData.toDisposeTemplate.dispose();
  }
};
QuickInputTreeRenderer = __decorateClass([
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IThemeService)
], QuickInputTreeRenderer);
export {
  QuickInputCheckboxStateHandler,
  QuickInputTreeRenderer
};
