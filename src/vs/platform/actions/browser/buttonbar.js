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
import { ButtonBar } from "../../../base/browser/ui/button/button.js";
import { createInstantHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { ActionRunner, SubmenuAction } from "../../../base/common/actions.js";
import { Codicon } from "../../../base/common/codicons.js";
import { Emitter } from "../../../base/common/event.js";
import { isMarkdownString, MarkdownString } from "../../../base/common/htmlContent.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { autorun } from "../../../base/common/observable.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { localize } from "../../../nls.js";
import { getActionBarActions } from "./menuEntryActionViewItem.js";
import { IMenuService, MenuItemAction } from "../common/actions.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { IContextMenuService } from "../../contextview/browser/contextView.js";
import { IHoverService } from "../../hover/browser/hover.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { renderAsPlaintext } from "../../../base/browser/markdownRenderer.js";
import { stripIcons } from "../../../base/common/iconLabels.js";
let WorkbenchButtonBar = class extends ButtonBar {
  constructor(container, _options, _contextMenuService, _keybindingService, telemetryService, _hoverService) {
    super(container);
    this._options = _options;
    this._contextMenuService = _contextMenuService;
    this._keybindingService = _keybindingService;
    this._hoverService = _hoverService;
    this._store = new DisposableStore();
    this._updateStore = new DisposableStore();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._actionRunner = this._store.add(new ActionRunner());
    if (_options?.telemetrySource) {
      this._actionRunner.onDidRun((e) => {
        telemetryService.publicLog2(
          "workbenchActionExecuted",
          { id: e.action.id, from: _options.telemetrySource }
        );
      }, void 0, this._store);
    }
  }
  get onWillRun() {
    return this._actionRunner.onWillRun;
  }
  get onDidRun() {
    return this._actionRunner.onDidRun;
  }
  dispose() {
    this._onDidChange.dispose();
    this._updateStore.dispose();
    this._store.dispose();
    super.dispose();
  }
  update(actions, secondary) {
    const configProvider = this._options?.buttonConfigProvider ?? (() => ({ showLabel: true }));
    this._updateStore.clear();
    this.clear();
    const hoverDelegate = this._updateStore.add(createInstantHoverDelegate());
    for (let i = 0; i < actions.length; i++) {
      const secondary2 = i > 0;
      const actionOrSubmenu = actions[i];
      let action;
      let btn;
      let tooltip;
      if (actionOrSubmenu instanceof SubmenuAction && actionOrSubmenu.actions.length > 1) {
        const [first, ...rest] = actionOrSubmenu.actions;
        action = first;
        tooltip = action.tooltip || action.label;
        tooltip = this._keybindingService.appendKeybinding(tooltip, action.id);
        btn = this.addButtonWithDropdown({
          addPrimaryActionToDropdown: false,
          secondary: configProvider(action, i)?.isSecondary ?? secondary2,
          actionRunner: this._actionRunner,
          actions: rest,
          contextMenuProvider: this._contextMenuService,
          ariaLabel: tooltip,
          supportIcons: true,
          small: this._options?.small
        });
      } else {
        action = actionOrSubmenu instanceof SubmenuAction && actionOrSubmenu.actions.length === 1 ? actionOrSubmenu.actions[0] : actionOrSubmenu;
        tooltip = action.tooltip || action.label;
        tooltip = this._keybindingService.appendKeybinding(tooltip, action.id);
        btn = this.addButton({
          secondary: configProvider(action, i)?.isSecondary ?? secondary2,
          ariaLabel: tooltip,
          supportIcons: true,
          small: this._options?.small
        });
      }
      btn.enabled = action.enabled;
      btn.checked = action.checked ?? false;
      btn.element.classList.add("default-colors");
      const config = configProvider(action, i);
      const showLabel = config?.showLabel ?? true;
      const showIcon = config?.showIcon;
      const customClass = config?.customClass;
      const customLabel = config?.customLabel;
      const customLabelObs = config?.customLabelObs;
      if (customClass) {
        btn.element.classList.add(customClass);
      }
      const composeLabel = (labelValue) => {
        if (showIcon && action instanceof MenuItemAction && ThemeIcon.isThemeIcon(action.item.icon) && showLabel) {
          return isMarkdownString(labelValue) ? new MarkdownString(`$(${action.item.icon.id}) ${labelValue.value}`, {
            isTrusted: labelValue.isTrusted,
            supportThemeIcons: true,
            supportHtml: labelValue.supportHtml
          }) : `$(${action.item.icon.id}) ${labelValue}`;
        }
        return labelValue;
      };
      const applyLabel = (labelValue) => {
        if (showLabel) {
          btn.label = composeLabel(labelValue);
        }
        const labelStringValue = stripIcons(renderAsPlaintext(labelValue));
        const ariaLabelWithKeybinding = this._keybindingService.appendKeybinding(labelStringValue, action.id);
        btn.setTitle(ariaLabelWithKeybinding);
        btn.setAriaLabel(ariaLabelWithKeybinding);
      };
      if (showLabel) {
        btn.label = composeLabel(customLabel ?? action.label);
      } else {
        btn.element.classList.add("monaco-text-button");
      }
      if (showIcon) {
        if (action instanceof MenuItemAction && ThemeIcon.isThemeIcon(action.item.icon)) {
          if (!showLabel) {
            btn.icon = action.item.icon;
          }
        } else if (action.class) {
          btn.element.classList.add(...action.class.split(" "));
        }
      }
      if (customLabelObs) {
        this._updateStore.add(autorun((reader) => {
          const v = customLabelObs.read(reader);
          applyLabel(v ?? customLabel ?? action.label);
        }));
      }
      this._updateStore.add(this._hoverService.setupManagedHover(hoverDelegate, btn.element, tooltip));
      this._updateStore.add(btn.onDidClick(async () => {
        if (this._options?.disableWhileRunning) {
          btn.enabled = false;
          try {
            await this._actionRunner.run(action);
          } finally {
            btn.enabled = action.enabled;
          }
        } else {
          this._actionRunner.run(action);
        }
      }));
    }
    if (secondary.length > 0) {
      const btn = this.addButton({
        secondary: true,
        ariaLabel: localize("moreActions", "More Actions"),
        small: this._options?.small
      });
      btn.icon = Codicon.dropDownButton;
      btn.element.classList.add("default-colors", "monaco-text-button");
      btn.enabled = true;
      this._updateStore.add(this._hoverService.setupManagedHover(hoverDelegate, btn.element, localize("moreActions", "More Actions")));
      this._updateStore.add(btn.onDidClick(async () => {
        this._contextMenuService.showContextMenu({
          getAnchor: () => btn.element,
          getActions: () => secondary,
          actionRunner: this._actionRunner,
          onHide: () => btn.element.setAttribute("aria-expanded", "false")
        });
        btn.element.setAttribute("aria-expanded", "true");
      }));
    }
    this._onDidChange.fire(this);
  }
};
WorkbenchButtonBar = __decorateClass([
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IHoverService)
], WorkbenchButtonBar);
let MenuWorkbenchButtonBar = class extends WorkbenchButtonBar {
  constructor(container, menuId, options, menuService, contextKeyService, contextMenuService, keybindingService, telemetryService, hoverService) {
    super(container, options, contextMenuService, keybindingService, telemetryService, hoverService);
    const menu = menuService.createMenu(menuId, contextKeyService);
    this._store.add(menu);
    const update = () => {
      this.clear();
      const actions = getActionBarActions(
        menu.getActions(options?.menuOptions),
        options?.toolbarOptions?.primaryGroup
      );
      super.update(actions.primary, actions.secondary);
    };
    this._store.add(menu.onDidChange(update));
    update();
  }
  dispose() {
    super.dispose();
  }
  update(_actions) {
    throw new Error("Use Menu or WorkbenchButtonBar");
  }
};
MenuWorkbenchButtonBar = __decorateClass([
  __decorateParam(3, IMenuService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IHoverService)
], MenuWorkbenchButtonBar);
export {
  MenuWorkbenchButtonBar,
  WorkbenchButtonBar
};
