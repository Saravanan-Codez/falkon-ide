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
import { isActiveDocument, reset } from "../../../../base/browser/dom.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { SubmenuAction } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar, WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { MenuId, MenuRegistry, SubmenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ChatAIDisabledSettingId } from "../../../../platform/chat/common/chatSettings.js";
const AGENT_STATUS_ENABLED_SETTING = "chat.agentsControl.enabled";
let CommandCenterControl = class {
  constructor(windowTitle, hoverDelegate, instantiationService, quickInputService) {
    this._disposables = new DisposableStore();
    this._onDidChangeVisibility = this._disposables.add(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this.element = document.createElement("div");
    this.element.classList.add("command-center");
    const titleToolbar = instantiationService.createInstance(MenuWorkbenchToolBar, this.element, MenuId.CommandCenter, {
      contextMenu: MenuId.TitleBarContext,
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: {
        primaryGroup: () => true
      },
      telemetrySource: "commandCenter",
      actionViewItemProvider: (action, options) => {
        if (action instanceof SubmenuItemAction && action.item.submenu === MenuId.CommandCenterCenter) {
          return instantiationService.createInstance(CommandCenterCenterViewItem, action, windowTitle, { ...options, hoverDelegate });
        } else {
          return createActionViewItem(instantiationService, action, { ...options, hoverDelegate });
        }
      }
    });
    let quickInputVisible = false;
    this._disposables.add(Event.filter(quickInputService.onShow, () => isActiveDocument(this.element), this._disposables)(() => {
      quickInputVisible = true;
      this._setVisibility(quickInputService.alignment.get() !== "top");
    }));
    this._disposables.add(quickInputService.onHide(() => {
      quickInputVisible = false;
      this._setVisibility(true);
    }));
    this._disposables.add(autorun((reader) => {
      const alignment = quickInputService.alignment.read(reader);
      if (quickInputVisible) {
        this._setVisibility(alignment !== "top");
      }
    }));
    this._disposables.add(titleToolbar);
  }
  _setVisibility(show) {
    this.element.classList.toggle("hide", !show);
    this._onDidChangeVisibility.fire();
  }
  dispose() {
    this._disposables.dispose();
  }
};
CommandCenterControl = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IQuickInputService)
], CommandCenterControl);
let CommandCenterCenterViewItem = class extends BaseActionViewItem {
  constructor(_submenu, _windowTitle, options, _hoverService, _keybindingService, _instaService, _editorGroupService, _configurationService) {
    super(void 0, _submenu.actions.find((action) => action.id === "workbench.action.quickOpenWithModes") ?? _submenu.actions[0], options);
    this._submenu = _submenu;
    this._windowTitle = _windowTitle;
    this._hoverService = _hoverService;
    this._keybindingService = _keybindingService;
    this._instaService = _instaService;
    this._editorGroupService = _editorGroupService;
    this._configurationService = _configurationService;
    this._hoverDelegate = options.hoverDelegate ?? getDefaultHoverDelegate("mouse");
  }
  static {
    this._quickOpenCommandId = "workbench.action.quickOpenWithModes";
  }
  render(container) {
    super.render(container);
    container.classList.add("command-center-center");
    container.classList.toggle("multiple", this._submenu.actions.length > 1);
    const hover = this._store.add(this._hoverService.setupManagedHover(this._hoverDelegate, container, this.getTooltip()));
    this._store.add(this._windowTitle.onDidChange(() => {
      hover.update(this.getTooltip());
    }));
    const groups = [];
    for (const action of this._submenu.actions) {
      if (action instanceof SubmenuAction) {
        groups.push(action.actions);
      } else {
        groups.push([action]);
      }
    }
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const toolbar = this._instaService.createInstance(WorkbenchToolBar, container, {
        hiddenItemStrategy: HiddenItemStrategy.NoHide,
        telemetrySource: "commandCenterCenter",
        actionViewItemProvider: (action, options) => {
          options = {
            ...options,
            hoverDelegate: this._hoverDelegate
          };
          if (action.id !== CommandCenterCenterViewItem._quickOpenCommandId) {
            return createActionViewItem(this._instaService, action, options);
          }
          const that = this;
          return this._instaService.createInstance(class CommandCenterQuickPickItem extends BaseActionViewItem {
            constructor() {
              super(void 0, action, options);
            }
            render(container2) {
              super.render(container2);
              container2.classList.toggle("command-center-quick-pick");
              container2.role = "button";
              container2.setAttribute("aria-description", this.getTooltip());
              const aiFeaturesDisabled = that._configurationService.getValue(ChatAIDisabledSettingId) === true;
              const aiCustomizationsDisabled = that._configurationService.getValue("disableAICustomizations") === true || that._configurationService.getValue("workbench.disableAICustomizations") === true;
              const forcedHidden = aiFeaturesDisabled && aiCustomizationsDisabled;
              const agentControlValue = that._configurationService.getValue(AGENT_STATUS_ENABLED_SETTING);
              const isCompactMode = !forcedHidden && (agentControlValue === true || agentControlValue === void 0 || agentControlValue === "compact");
              container2.classList.toggle("compact-mode", isCompactMode);
              const action2 = this.action;
              const searchIcon = document.createElement("span");
              searchIcon.ariaHidden = "true";
              searchIcon.className = action2.class ?? "";
              searchIcon.classList.add("search-icon");
              const label = this._getLabel();
              const labelElement = document.createElement("span");
              labelElement.classList.add("search-label");
              labelElement.textContent = label;
              if (isCompactMode) {
                reset(container2, labelElement);
              } else {
                reset(container2, searchIcon, labelElement);
              }
              const hover2 = this._store.add(that._hoverService.setupManagedHover(that._hoverDelegate, container2, this.getTooltip()));
              this._store.add(that._windowTitle.onDidChange(() => {
                hover2.update(this.getTooltip());
                labelElement.textContent = this._getLabel();
              }));
              this._store.add(that._editorGroupService.onDidChangeEditorPartOptions(({ newPartOptions, oldPartOptions }) => {
                if (newPartOptions.showTabs !== oldPartOptions.showTabs) {
                  hover2.update(this.getTooltip());
                  labelElement.textContent = this._getLabel();
                }
              }));
            }
            getTooltip() {
              return that.getTooltip();
            }
            _getLabel() {
              const { prefix, suffix } = that._windowTitle.getTitleDecorations();
              let label = that._windowTitle.workspaceName;
              if (that._windowTitle.isCustomTitleFormat()) {
                label = that._windowTitle.getWindowTitle();
              } else if (that._editorGroupService.partOptions.showTabs === "none") {
                label = that._windowTitle.fileName ?? label;
              }
              if (!label) {
                label = localize("label.dfl", "Search");
              }
              if (prefix) {
                label = localize("label1", "{0} {1}", prefix, label);
              }
              if (suffix) {
                label = localize("label2", "{0} {1}", label, suffix);
              }
              return label.replaceAll(/\r\n|\r|\n/g, "\u23CE");
            }
          });
        }
      });
      toolbar.setActions(group);
      this._store.add(toolbar);
      if (i < groups.length - 1) {
        const icon = renderIcon(Codicon.circleSmallFilled);
        icon.style.padding = "0 8px";
        icon.style.height = "100%";
        icon.style.opacity = "0.5";
        container.appendChild(icon);
      }
    }
  }
  getTooltip() {
    const kb = this._keybindingService.lookupKeybinding(this.action.id)?.getLabel();
    const title = kb ? localize("title", "Search {0} ({1}) \u2014 {2}", this._windowTitle.workspaceName, kb, this._windowTitle.value) : localize("title2", "Search {0} \u2014 {1}", this._windowTitle.workspaceName, this._windowTitle.value);
    return title;
  }
};
CommandCenterCenterViewItem = __decorateClass([
  __decorateParam(3, IHoverService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IEditorGroupsService),
  __decorateParam(7, IConfigurationService)
], CommandCenterCenterViewItem);
MenuRegistry.appendMenuItem(MenuId.CommandCenter, {
  submenu: MenuId.CommandCenterCenter,
  title: localize("title3", "Command Center"),
  icon: Codicon.shield,
  order: 101
});
export {
  CommandCenterControl
};
